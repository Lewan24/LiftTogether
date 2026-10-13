using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using SkiaSharp;

namespace LiftTogether.Api.Tests;

public sealed class ApiTests
{
    [Fact]
    public async Task DevelopmentStartup_InitializesEmptyDatabase_WithoutDemoCredentials()
    {
        var ownerConnection = Environment.GetEnvironmentVariable("LIFT_TEST_ADMIN_CONNECTION")
            ?? throw new InvalidOperationException("Set LIFT_TEST_ADMIN_CONNECTION to a disposable PostgreSQL database ending in _tests.");
        var connection = new NpgsqlConnectionStringBuilder(ownerConnection);
        Assert.EndsWith("_tests", connection.Database);
        connection.Database += "_startup_tests";

        await using var db = new GymDb(new DbContextOptionsBuilder<GymDb>()
            .UseNpgsql(connection.ConnectionString).Options);
        await db.Database.EnsureDeletedAsync();
        // Create an empty database so the regression exercises missing tables, not a missing server.
        await using (var server = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(connection.ConnectionString) { Database = "postgres" }.ConnectionString))
        {
            await server.OpenAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE \"{connection.Database!.Replace("\"", "\"\"")}\"", server);
            await create.ExecuteNonQueryAsync();
        }

        await using (var uninitialized = new TestApi(connection.ConnectionString))
        {
            var response = await uninitialized.CreateClient().GetAsync("/api/public");
            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            var problem = JsonNode.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal("DATABASE_NOT_INITIALIZED", problem!["code"]!.GetValue<string>());
        }

        await using (var initialized = new TestApi(connection.ConnectionString, autoInitialize: true))
        {
            Assert.True((await initialized.CreateClient().GetAsync("/api/public")).IsSuccessStatusCode);
            Assert.True((await initialized.CreateClient().GetAsync("/health/ready")).IsSuccessStatusCode);
        }

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.Single(await db.Settings.ToListAsync());
        Assert.Equal(3, await db.Categories.CountAsync());
        Assert.Empty(await db.Members.ToListAsync());
        await using (var restarted = new TestApi(connection.ConnectionString, autoInitialize: true))
            Assert.True((await restarted.CreateClient().GetAsync("/api/public")).IsSuccessStatusCode);
        Assert.Equal(3, await db.Categories.CountAsync());
        await using (var withAdministrator = new TestApi(connection.ConnectionString, autoInitialize: true, useDefaultAdministrator: true))
        {
            Assert.True((await withAdministrator.CreateClient().GetAsync("/api/public")).IsSuccessStatusCode);
            var administrator = await db.Members.AsNoTracking().SingleAsync();
            Assert.Equal("admin", administrator.Role);
            Assert.True(administrator.Verified);
            Assert.Equal("admin@lifttogether.local", administrator.Email);
            Assert.NotEqual("Local-admin-2026!", administrator.PasswordHash);
            Assert.NotEqual(PasswordVerificationResult.Failed,
                Hasher().VerifyHashedPassword(administrator, administrator.PasswordHash, "Local-admin-2026!"));
            await Login(withAdministrator, administrator.Email, "Local-admin-2026!");
        }
        await using (var restartedWithAdministrator = new TestApi(connection.ConnectionString, autoInitialize: true, useDefaultAdministrator: true))
        {
            Assert.True((await restartedWithAdministrator.CreateClient().GetAsync("/api/public")).IsSuccessStatusCode);
        }
        Assert.Single(await db.Members.AsNoTracking().ToListAsync());
        Assert.Equal(1, await db.Audit.CountAsync(entry => entry.Action == "bootstrap.admin"));
        Assert.Single(await db.Discussions.ToListAsync());
        Assert.True((await db.Discussions.SingleAsync()).Pinned);
        Assert.Equal(1, await db.Audit.CountAsync(entry => entry.Action == "bootstrap.regulations"));
        await db.Database.EnsureDeletedAsync();
    }

    [Fact]
    public async Task PostgreSql_EndToEnd_Authorization_Csrf_Concurrency_AndPersistence()
    {
        var connection = Environment.GetEnvironmentVariable("LIFT_TEST_CONNECTION") ?? throw new InvalidOperationException("Set LIFT_TEST_CONNECTION to a disposable PostgreSQL database ending in _tests.");
        var ownerConnection = Environment.GetEnvironmentVariable("LIFT_TEST_ADMIN_CONNECTION") ?? connection;
        var builder = new NpgsqlConnectionStringBuilder(ownerConnection);
        Assert.EndsWith("_tests", builder.Database);
        var runtime = new NpgsqlConnectionStringBuilder(connection);
        Assert.EndsWith("_tests", runtime.Database);
        Assert.Equal(builder.Database, runtime.Database);
        Assert.Equal(builder.Host, runtime.Host);
        Assert.Equal(builder.Port, runtime.Port);
        var options = new DbContextOptionsBuilder<GymDb>().UseNpgsql(ownerConnection).Options;
        await using var setup = new GymDb(options);
        await setup.Database.EnsureDeletedAsync();
        await setup.Database.MigrateAsync();
        await setup.Database.ExecuteSqlRawAsync("GRANT USAGE ON SCHEMA public TO liftapp; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO liftapp; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO liftapp;");
        var admin = new Member
        {
            Role = "admin",
            Verified = true,
            FirstName = "Test",
            LastName = "Admin",
            Email = "admin@tests.example",
            Dormitory = "DS 3",
            Room = "Office"
        };
        var password = "Test-password-2026!";
        admin.PasswordHash = Hasher().HashPassword(admin, password);
        var members = Enumerable.Range(0, 13)
            .Select(i => new Member
{
    FirstName = "Member",
    LastName = $"Number{i}",
    Email = $"member{i}@tests.example",
    Dormitory = "DS 3",
    Room = "1",
    Verified = true
})
    .ToArray();
        foreach (var m in members) m.PasswordHash = Hasher().HashPassword(m, password);
        setup.Members.Add(admin);
        setup.Members.AddRange(members);
        setup.Settings.Add(new GymSettings());
        var category = new Category
        {
            Name = "General"
        };
        setup.Categories.Add(category);
        await setup.SaveChangesAsync();
        await DatabaseSetup.Seed(setup, new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build(), Hasher());
        await using (var runtimeDb = new NpgsqlConnection(connection))
        {
            await runtimeDb.OpenAsync();
            await using var permissions = new NpgsqlCommand("SELECT has_table_privilege(current_user, '\"Audit\"', 'UPDATE') OR has_table_privilege(current_user, '\"Audit\"', 'DELETE') OR has_table_privilege(current_user, '\"__EFMigrationsHistory\"', 'SELECT')", runtimeDb);
            Assert.False((bool)(await permissions.ExecuteScalarAsync())!);
        }
        await using var factory = new TestApi(connection);
        var anonymous = factory.CreateClient();
        Assert.True((await anonymous.GetAsync("/health/ready")).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/bookings")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PostAsJsonAsync("/api/auth/login", new
        {
            email = admin.Email,
            password
        })).StatusCode);
        var adminClient = await Login(factory, admin.Email, password);
        var memberClient = await Login(factory, members[0].Email, password);
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.GetAsync("/api/audit")).StatusCode);
        var memberInput = new AdminMemberInput("Created", "Member", "created@tests.example", "DS 3", "123", "", "", true, "Created-password-2026!", AdminNotes: "Identity needs confirmation");
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.PostAsJsonAsync("/api/users", memberInput)).StatusCode);
        var createdMember = await Json(await adminClient.PostAsJsonAsync("/api/users", memberInput));
        Assert.Equal("Identity needs confirmation", createdMember["adminNotes"]!.GetValue<string>());
        Assert.Equal("user", createdMember["role"]!.GetValue<string>());
        var createdId = createdMember["id"]!.GetValue<Guid>();
        var createdVersion = createdMember["version"]!.GetValue<uint>();
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.PatchAsJsonAsync($"/api/users/{members[0].Id}", memberInput with { Role = "admin" })).StatusCode);
        var adminVersion = (await Json(await adminClient.GetAsync("/api/auth/me")))["version"]!.GetValue<uint>();
        var adminInput = new AdminMemberInput(admin.FirstName, admin.LastName, admin.Email, admin.Dormitory, admin.Room, admin.FacebookUrl, admin.Phone, true, null, adminVersion, Role: "user");
        Assert.Equal(HttpStatusCode.Conflict, (await adminClient.PatchAsJsonAsync($"/api/users/{admin.Id}", adminInput)).StatusCode);
        var roleClient = await Login(factory, memberInput.Email, memberInput.Password!);
        var promoted = await Json(await adminClient.PatchAsJsonAsync($"/api/users/{createdId}", memberInput with { Password = null, Role = "admin", Version = createdVersion }));
        Assert.Equal("admin", promoted["role"]!.GetValue<string>());
        Assert.Null(JsonNode.Parse(await (await roleClient.GetAsync("/api/auth/me")).Content.ReadAsStringAsync()));
        var promotedClient = await Login(factory, memberInput.Email, memberInput.Password!);
        var demoted = await Json(await adminClient.PatchAsJsonAsync($"/api/users/{createdId}", memberInput with { Password = null, Role = "user", Version = promoted["version"]!.GetValue<uint>() }));
        Assert.Equal("user", demoted["role"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.Unauthorized, (await promotedClient.GetAsync("/api/users")).StatusCode);
        createdVersion = demoted["version"]!.GetValue<uint>();
        var createdClient = await Login(factory, memberInput.Email, memberInput.Password!);
        var ownProfile = await Json(await createdClient.GetAsync("/api/auth/me"));
        Assert.Null(ownProfile["adminNotes"]);
        var adminsList = await Json(await adminClient.GetAsync("/api/users?role=admin"));
        Assert.Contains(adminsList["users"]!.AsArray(), entry => entry!["id"]!.GetValue<Guid>() == admin.Id);
        Assert.All(adminsList["users"]!.AsArray(), entry => Assert.Equal("admin", entry!["role"]!.GetValue<string>()));
        Assert.Equal(HttpStatusCode.BadRequest, (await adminClient.PatchAsJsonAsync($"/api/users/{createdId}", memberInput with { AdminNotes = new string('x', 4001), Version = createdVersion })).StatusCode);
        var changedMember = await Json(await adminClient.PatchAsJsonAsync($"/api/users/{createdId}", memberInput with
        {
            AdminNotes = "Confirmed by administration", Room = "456", Password = "Reset-password-2026!", Version = createdVersion
        }));
        Assert.Equal("Confirmed by administration", changedMember["adminNotes"]!.GetValue<string>());
        Assert.Equal("456", changedMember["room"]!.GetValue<string>());
        Assert.Null(JsonNode.Parse(await (await createdClient.GetAsync("/api/auth/me")).Content.ReadAsStringAsync()));
        Assert.Equal(HttpStatusCode.Conflict, (await adminClient.PatchAsJsonAsync($"/api/users/{createdId}", memberInput with { Version = createdVersion })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await adminClient.PostAsJsonAsync("/api/users", memberInput)).StatusCode);
        foreach (var attemptedEmail in new[] { admin.Email, members[0].Email, "unknown@tests.example" })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await adminClient.PostAsJsonAsync("/api/auth/login", new { email = attemptedEmail, password = "Incorrect-password!" })).StatusCode);
        }
        var auditPage = await Json(await adminClient.GetAsync("/api/audit"));
        foreach (var (email, role) in new[] { (admin.Email, "admin"), (members[0].Email, "user"), ("unknown@tests.example", (string?)null) })
        {
            Assert.Contains(auditPage["entries"]!.AsArray(), entry => entry!["action"]!.GetValue<string>() == "auth.login.failed"
                && JsonNode.Parse(entry["target"]!.GetValue<string>())!["email"]!.GetValue<string>() == email
                && JsonNode.Parse(entry["target"]!.GetValue<string>())!["accountRole"]?.GetValue<string>() == role
                && entry["actorId"] == null);
        }
        Assert.Contains(auditPage["entries"]!.AsArray(), entry => entry!["action"]!.GetValue<string>() == "member.update" && entry["actorName"]!.GetValue<string>() == "Test Admin");
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.PostAsJsonAsync("/api/categories", new
        {
            name = "Forbidden"
        })).StatusCode);
        var today = Rules.Today().ToString("yyyy-MM-dd");
        var yesterday = Rules.Today().AddDays(-1).ToString("yyyy-MM-dd");
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.PostAsJsonAsync("/api/bookings", new
        {
            date = yesterday, start = "07:00", end = "08:00"
        })).StatusCode);
        var historicalBooking = await Json(await adminClient.PostAsJsonAsync("/api/bookings", new
        {
            date = yesterday, start = "07:00", end = "08:00"
        }));
        Assert.Equal(yesterday, historicalBooking["date"]!.GetValue<string>());
        Assert.True((await adminClient.DeleteAsync($"/api/bookings/{historicalBooking["id"]}")).IsSuccessStatusCode);
        var booking = await Json(await memberClient.PostAsJsonAsync("/api/bookings", new
        {
            date = today,
            start = "07:00",
            end = "10:00"
        }));
        Assert.Equal(members[0].Id.ToString(), booking["userId"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.BadRequest, (await memberClient.PatchAsJsonAsync($"/api/bookings/{booking["id"]}", new
        {
            date = today,
            start = "07:00",
            end = "10:30",
            version = booking["version"]!.GetValue<uint>()
        })).StatusCode);
        var otherClient = await Login(factory, members[1].Email, password);
        Assert.Equal(HttpStatusCode.Forbidden, (await otherClient.PatchAsJsonAsync($"/api/bookings/{booking["id"]}", new
        {
            date = today,
            start = "11:00",
            end = "12:00",
            version = booking["version"]!.GetValue<uint>()
        })).StatusCode);
        // Two independent HTTP requests contend for the final daily place at different times.
        for (var i = 1; i < 11; i++) setup.Bookings.Add(new Booking
        {
            UserId = members[i].Id,
            Date = Rules.Today(),
            StartMinute = 360,
            EndMinute = 390
        });
        await setup.SaveChangesAsync();
        var penultimate = await Login(factory, members[11].Email, password);
        var last = await Login(factory, members[12].Email, password);
        var races = await Task.WhenAll(penultimate.PostAsJsonAsync("/api/bookings", new
        {
            date = today,
            start = "12:00",
            end = "13:00"
        }), last.PostAsJsonAsync("/api/bookings", new
        {
            date = today,
            start = "15:00",
            end = "16:00"
        }));
        Assert.Single(races, r => r.IsSuccessStatusCode);
        Assert.Single(races, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(12, await setup.Bookings.CountAsync(b => !b.Cancelled));
        Assert.Equal(HttpStatusCode.Conflict, (await memberClient.PostAsJsonAsync($"/api/bookings/{booking["id"]}/cancel", new
        {
            version = 0
        })).StatusCode);
        Assert.True((await memberClient.PostAsJsonAsync($"/api/bookings/{booking["id"]}/cancel", new
        {
            version = booking["version"]!.GetValue<uint>()
        })).IsSuccessStatusCode);
        var currentProfile = await Json(await memberClient.GetAsync("/api/auth/me"));
        Assert.True((await memberClient.PatchAsJsonAsync($"/api/auth/profile", new
        {
            firstName = "Updated",
            lastName = "Member",
            email = members[0].Email,
            dormitory = "DS 3",
            room = "2",
            facebookUrl = "",
            phone = "",
            version = currentProfile["version"]!.GetValue<uint>(),
            role = "admin",
            verified = true
        })).IsSuccessStatusCode);
        var me = await Json(await memberClient.GetAsync("/api/auth/me"));
        Assert.Equal("user", me["role"]!.GetValue<string>());
        var discussion = await Json(await memberClient.PostAsJsonAsync("/api/forum", new
        {
            title = "Training",
            content = "<h2>Heading</h2><p onclick='evil()'>Hello<script>alert(1)</script></p>",
            categoryId = category.Id,
            images = Array.Empty<object>()
        }));
        var discussionId = discussion["id"]!.GetValue<string>();
        var detail = await Json(await memberClient.GetAsync($"/api/forum/{discussionId}"));
        var html = detail["discussion"]!["content"]!.GetValue<string>();
        Assert.DoesNotContain("<script", html);
        Assert.DoesNotContain("onclick", html);
        Assert.Contains("<h2>", html);
        Assert.Equal(HttpStatusCode.Forbidden, (await otherClient.PatchAsJsonAsync($"/api/forum/{discussionId}", new
        {
            title = "Hijack",
            content = "<p>Bad</p>",
            categoryId = category.Id,
            images = Array.Empty<object>(),
            version = detail["discussion"]!["version"]!.GetValue<uint>()
        })).StatusCode);
        Assert.True((await otherClient.PostAsJsonAsync($"/api/forum/{discussionId}/comments", new
        {
            content = "<p>Reply</p>",
            images = Array.Empty<object>()
        })).IsSuccessStatusCode);
        detail = await Json(await memberClient.GetAsync($"/api/forum/{discussionId}"));
        var replyId = detail["discussion"]!["comments"]![0]!["id"]!.GetValue<string>();
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.DeleteAsync($"/api/forum/{discussionId}/comments/{replyId}")).StatusCode);
        Assert.True((await adminClient.PatchAsJsonAsync($"/api/forum/{discussionId}/pin", new
        {
            pinned = true,
            version = detail["discussion"]!["version"]!.GetValue<uint>()
        })).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await adminClient.PatchAsJsonAsync($"/api/forum/{discussionId}/pin", new
        {
            pinned = false,
            version = detail["discussion"]!["version"]!.GetValue<uint>()
        })).StatusCode);
        var target = await Json(await adminClient.PostAsJsonAsync("/api/categories", new
        {
            name = "Training"
        }));
        var delete = new HttpRequestMessage(HttpMethod.Delete, $"/api/categories/{category.Id}")
        {
            Content = JsonContent.Create(new
            {
                replacement = target["id"]!.GetValue<string>(),
                version = category.Version
            })
        };
        Assert.True((await adminClient.SendAsync(delete)).IsSuccessStatusCode);
        detail = await Json(await memberClient.GetAsync($"/api/forum/{discussionId}"));
        Assert.Equal(target["id"]!.GetValue<string>(), detail["discussion"]!["categoryId"]!.GetValue<string>());
        using var bitmap = new SKBitmap(2, 2);
        bitmap.Erase(SKColors.Green);
        using var encoded = SKImage.FromBitmap(bitmap).Encode(SKEncodedImageFormat.Png, 100);
        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(encoded.ToArray()), "file", "test.png");
        var image = await Json(await memberClient.PostAsync("/api/images", form));
        Assert.True((await memberClient.GetAsync(image["src"]!.GetValue<string>())).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await otherClient.GetAsync(image["src"]!.GetValue<string>())).StatusCode);
        Assert.True((await memberClient.PostAsJsonAsync($"/api/forum/{discussionId}/comments", new
        {
            content = "<p>Image reply</p>",
            images = new[] {
image }
        })).IsSuccessStatusCode);
        detail = await Json(await memberClient.GetAsync($"/api/forum/{discussionId}"));
        var imageReply = detail["discussion"]!["comments"]!.AsArray().Single(r => r!["images"]!.AsArray().Count == 1)!;
        Assert.True((await memberClient.DeleteAsync($"/api/forum/{discussionId}/comments/{imageReply["id"]}")).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await memberClient.GetAsync(image["src"]!.GetValue<string>())).StatusCode);
        using var nextForm = new MultipartFormDataContent();
        nextForm.Add(new ByteArrayContent(encoded.ToArray()), "file", "discussion.png");
        image = await Json(await memberClient.PostAsync("/api/images", nextForm));
        Assert.True((await memberClient.PatchAsJsonAsync($"/api/forum/{discussionId}", new
        {
            title = "Training with image",
            content = "<p>Attached</p>",
            categoryId = target["id"]!.GetValue<string>(),
            images = new[] {
image },
            version = detail["discussion"]!["version"]!.GetValue<uint>()
        })).IsSuccessStatusCode);
        using var badForm = new MultipartFormDataContent();
        badForm.Add(new StringContent("<svg onload='evil()'></svg>"), "file", "fake.png");
        Assert.Equal(HttpStatusCode.BadRequest, (await memberClient.PostAsync("/api/images", badForm)).StatusCode);
        var draft = await Json(await adminClient.PostAsJsonAsync("/api/posts", new
        {
            titlePl = "Draft",
            titleEn = "Draft",
            contentPl = "Private",
            contentEn = "Private",
            status = "draft",
            important = false
        }));
        Assert.Equal(HttpStatusCode.NotFound, (await memberClient.GetAsync($"/api/posts/{draft["id"]}")).StatusCode);
        // New app host reads the same database; no in-memory repository is involved.
        await using (var restarted = new TestApi(connection))
        {
            var client = await Login(restarted, members[0].Email, password);
            Assert.True((await client.GetAsync($"/api/forum/{discussionId}")).IsSuccessStatusCode);
        }
        Assert.True((await adminClient.DeleteAsync($"/api/forum/{discussionId}")).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await memberClient.GetAsync(image["src"]!.GetValue<string>())).StatusCode);
        var existingUploads = await setup.Uploads.CountAsync(x => x.UserId == members[0].Id);
        for (var i = existingUploads; i < 47; i++) setup.Uploads.Add(new Upload
        {
            UserId = members[0].Id,
            Name = "quota.jpg",
            Bytes = [1]
        });
        await setup.SaveChangesAsync();
        using var quotaFormA = new MultipartFormDataContent();
        quotaFormA.Add(new ByteArrayContent(encoded.ToArray()), "file", "a.png");
        using var quotaFormB = new MultipartFormDataContent();
        quotaFormB.Add(new ByteArrayContent(encoded.ToArray()), "file", "b.png");
        await using (var secondHost = new TestApi(connection))
        {
            var secondClient = await Login(secondHost, members[0].Email, password);
            var uploads = await Task.WhenAll(memberClient.PostAsync("/api/images", quotaFormA), secondClient.PostAsync("/api/images", quotaFormB));
            Assert.Single(uploads, r => r.IsSuccessStatusCode);
            Assert.Single(uploads, r => r.StatusCode == HttpStatusCode.TooManyRequests);
            Assert.Equal(48, await setup.Uploads.CountAsync(x => x.UserId == members[0].Id));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.GetAsync("/api/admin/statistics")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminClient.GetAsync("/api/admin/statistics?period=year")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminClient.GetAsync("/api/admin/statistics?date=2026-02-31")).StatusCode);
        var weekStatistics = await Json(await adminClient.GetAsync("/api/admin/statistics?period=week"));
        Assert.Equal(await setup.Members.CountAsync(), weekStatistics["totalUsers"]!.GetValue<int>());
        Assert.Equal(await setup.Discussions.CountAsync(), weekStatistics["forumTopics"]!.GetValue<int>());
        Assert.Equal(7, weekStatistics["daily"]!.AsArray().Count);
        Assert.Equal(await setup.Bookings.CountAsync(booking => !booking.Cancelled), weekStatistics["bookings"]!.GetValue<int>());
        Assert.Equal(await setup.Bookings.CountAsync(booking => booking.Cancelled), weekStatistics["cancelledBookings"]!.GetValue<int>());
        var monthStatistics = await Json(await adminClient.GetAsync($"/api/admin/statistics?period=month&date={today}"));
        Assert.Equal(DateTime.DaysInMonth(Rules.Today().Year, Rules.Today().Month), monthStatistics["daily"]!.AsArray().Count);
        var community = await Json(await memberClient.GetAsync("/api/dashboard"));
        Assert.Equal(await setup.Discussions.CountAsync(), community["forumTopics"]!.GetValue<int>());
        Assert.DoesNotContain(community["latestNews"]!.AsArray(), post => post!["id"]!.GetValue<long>() == draft["id"]!.GetValue<long>());
        Assert.Equal(await setup.Posts.CountAsync(post => post.Status == "published"), community["newsPosts"]!.GetValue<int>());
        Assert.True((await memberClient.PostAsync("/api/auth/logout", null)).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await memberClient.GetAsync("/api/bookings")).StatusCode);
        Assert.True(await setup.Audit.AnyAsync(a => a.Action == "forum.pin"));
        await setup.Database.EnsureDeletedAsync();
    }
    [Fact]
    public void BookingRelease_UsesWarsawTime_AndConfiguredBoundary()
    {
        var settings = new GymSettings();
        var nextMonday = new DateOnly(2026, 10, 12);
        Assert.False(Rules.BookingWindow(nextMonday, settings, DateTimeOffset.Parse("2026-10-11T15:59:59Z")));
        Assert.True(Rules.BookingWindow(nextMonday, settings, DateTimeOffset.Parse("2026-10-11T16:00:00Z")));
        Assert.True(Rules.BookingWindow(nextMonday.AddDays(6), settings, DateTimeOffset.Parse("2026-10-11T16:00:00Z")));
        Assert.False(Rules.BookingWindow(nextMonday.AddDays(7), settings, DateTimeOffset.Parse("2026-10-11T16:00:00Z")));
        Assert.True(Rules.BookingWindow(nextMonday.AddDays(-1), settings, DateTimeOffset.Parse("2026-10-11T16:00:00Z")));
        Assert.False(Rules.BookingWindow(nextMonday.AddDays(-2), settings, DateTimeOffset.Parse("2026-10-11T16:00:00Z")));
        Assert.False(Rules.BookingWindow(nextMonday.AddDays(-8), settings, DateTimeOffset.Parse("2026-10-11T16:00:00Z")));
        settings.NextWeekReleaseDay = 5;
        settings.NextWeekReleaseTime = "20:30";
        Assert.False(Rules.BookingWindow(nextMonday, settings, DateTimeOffset.Parse("2026-10-09T18:29:59Z")));
        Assert.True(Rules.BookingWindow(nextMonday, settings, DateTimeOffset.Parse("2026-10-09T18:30:00Z")));
        settings = new GymSettings();
        Assert.True(Rules.BookingWindow(new DateOnly(2026, 12, 28), settings, DateTimeOffset.Parse("2026-12-27T17:00:00Z")));
    }
    [Fact]
    public void Rules_Reject_ExecutableUrls_And_OverlongBookings()
    {
        Assert.Throws<ApiFault>(() => Rules.Facebook("https://facebook.com.evil.test/x"));
        Assert.Throws<ApiFault>(() => Rules.Facebook("javascript:alert(1)"));
        Assert.Throws<ApiFault>(() => Rules.Password("short"));
        Assert.Throws<ApiFault>(() => Rules.Booking(new("2026-10-09", "07:00", "10:30"), true));
        Assert.DoesNotContain("onerror", Rules.Html("<img src=x onerror=alert(1)><p>Text</p>"));
    }
    private static IPasswordHasher<Member> Hasher() => new PasswordHasher<Member>();
    private static async Task<HttpClient> Login(TestApi factory, string email, string password)
    {
        var client = factory.CreateClient();
        await Csrf(client);
        await Json(await client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password
        }));
        await Csrf(client);
        return client;
    }
    private static async Task Csrf(HttpClient client)
    {
        var token = await Json(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-Token");
        client.DefaultRequestHeaders.Add("X-CSRF-Token", token["token"]!.GetValue<string>());
    }
    private static async Task<JsonNode> Json(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"HTTP {(int)response.StatusCode}: {body}");
        return JsonNode.Parse(body)!;
    }
}
public sealed class TestApi(string connection, bool autoInitialize = false, bool useDefaultAdministrator = false) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            var overrides = new Dictionary<string, string?>
            {
                ["Database:AutoInitialize"] = autoInitialize.ToString()
            };
            if (!useDefaultAdministrator)
            {
                overrides["Bootstrap:AdminEmail"] = null;
                overrides["Bootstrap:AdminPassword"] = null;
            }
            config.AddInMemoryCollection(overrides);
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<GymDb>>();
            services.RemoveAll<GymDb>();
            services.AddDbContext<GymDb>(o => o.UseNpgsql(connection));
        });
    }
}
