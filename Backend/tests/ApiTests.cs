using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using SkiaSharp;

namespace LiftTogether.Api.Tests;

public sealed class ApiTests
{
    [Fact]
    public async Task PostgreSql_EndToEnd_Authorization_Csrf_Concurrency_AndPersistence()
    {
        var connection = Environment.GetEnvironmentVariable("LIFT_TEST_CONNECTION") ?? throw new InvalidOperationException("Set LIFT_TEST_CONNECTION to a disposable PostgreSQL database ending in _tests.");
        var ownerConnection = Environment.GetEnvironmentVariable("LIFT_TEST_ADMIN_CONNECTION") ?? connection;
        var builder = new NpgsqlConnectionStringBuilder(ownerConnection); Assert.EndsWith("_tests", builder.Database);
        var options = new DbContextOptionsBuilder<GymDb>().UseNpgsql(ownerConnection).Options;
        await using var setup = new GymDb(options);
        await setup.Database.EnsureDeletedAsync(); await setup.Database.MigrateAsync();
        await setup.Database.ExecuteSqlRawAsync("GRANT USAGE ON SCHEMA public TO liftapp; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO liftapp; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO liftapp;");
        var admin = new Member { Role = "admin", Verified = true, FirstName = "Test", LastName = "Admin", Email = "admin@tests.example", Dormitory = "DS 3", Room = "Office" };
        var password = "Test-password-2026!"; admin.PasswordHash = Hasher().HashPassword(admin, password);
        var members = Enumerable.Range(0, 13).Select(i => new Member { FirstName = "Member", LastName = $"Number{i}", Email = $"member{i}@tests.example", Dormitory = "DS 3", Room = "1", Verified = true }).ToArray();
        foreach (var m in members) m.PasswordHash = Hasher().HashPassword(m, password);
        setup.Members.Add(admin); setup.Members.AddRange(members); setup.Settings.Add(new GymSettings()); var category = new Category { Name = "General" }; setup.Categories.Add(category); await setup.SaveChangesAsync();
        await using var factory = new TestApi(connection);
        var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/bookings")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PostAsJsonAsync("/api/auth/login", new { email = admin.Email, password })).StatusCode);
        var adminClient = await Login(factory, admin.Email, password);
        var memberClient = await Login(factory, members[0].Email, password);
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.PostAsJsonAsync("/api/categories", new { name = "Forbidden" })).StatusCode);
        var today = Rules.Today().ToString("yyyy-MM-dd");
        var booking = await Json(await memberClient.PostAsJsonAsync("/api/bookings", new { date = today, start = "07:00", end = "10:00" }));
        Assert.Equal(members[0].Id.ToString(), booking["userId"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.BadRequest, (await memberClient.PatchAsJsonAsync($"/api/bookings/{booking["id"]}", new { date = today, start = "07:00", end = "10:30", version = booking["version"]!.GetValue<uint>() })).StatusCode);
        var otherClient = await Login(factory, members[1].Email, password);
        Assert.Equal(HttpStatusCode.Forbidden, (await otherClient.PatchAsJsonAsync($"/api/bookings/{booking["id"]}", new { date = today, start = "11:00", end = "12:00", version = booking["version"]!.GetValue<uint>() })).StatusCode);
        // Two independent HTTP requests contend for the final daily place at different times.
        for (var i = 1; i < 11; i++) setup.Bookings.Add(new Booking { UserId = members[i].Id, Date = Rules.Today(), StartMinute = 360, EndMinute = 390 });
        await setup.SaveChangesAsync();
        var penultimate = await Login(factory, members[11].Email, password);
        var last = await Login(factory, members[12].Email, password);
        var races = await Task.WhenAll(penultimate.PostAsJsonAsync("/api/bookings", new { date = today, start = "12:00", end = "13:00" }), last.PostAsJsonAsync("/api/bookings", new { date = today, start = "15:00", end = "16:00" }));
        Assert.Single(races, r => r.IsSuccessStatusCode); Assert.Single(races, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(12, await setup.Bookings.CountAsync(b => !b.Cancelled));
        Assert.True((await memberClient.PostAsync($"/api/bookings/{booking["id"]}/cancel", null)).IsSuccessStatusCode);
        var currentProfile = await Json(await memberClient.GetAsync("/api/auth/me"));
        Assert.True((await memberClient.PatchAsJsonAsync($"/api/auth/profile", new { firstName = "Updated", lastName = "Member", email = members[0].Email, dormitory = "DS 3", room = "2", facebookUrl = "", phone = "", version = currentProfile["version"]!.GetValue<uint>(), role = "admin", verified = true })).IsSuccessStatusCode);
        var me = await Json(await memberClient.GetAsync("/api/auth/me")); Assert.Equal("user", me["role"]!.GetValue<string>());
        var discussion = await Json(await memberClient.PostAsJsonAsync("/api/forum", new { title = "Training", content = "<h2>Heading</h2><p onclick='evil()'>Hello<script>alert(1)</script></p>", categoryId = category.Id, images = Array.Empty<object>() }));
        var discussionId = discussion["id"]!.GetValue<string>();
        var detail = await Json(await memberClient.GetAsync($"/api/forum/{discussionId}")); var html = detail["discussion"]!["content"]!.GetValue<string>(); Assert.DoesNotContain("<script", html); Assert.DoesNotContain("onclick", html); Assert.Contains("<h2>", html);
        Assert.Equal(HttpStatusCode.Forbidden, (await otherClient.PatchAsJsonAsync($"/api/forum/{discussionId}", new { title = "Hijack", content = "<p>Bad</p>", categoryId = category.Id, images = Array.Empty<object>(), version = detail["discussion"]!["version"]!.GetValue<uint>() })).StatusCode);
        Assert.True((await otherClient.PostAsJsonAsync($"/api/forum/{discussionId}/comments", new { content = "<p>Reply</p>", images = Array.Empty<object>() })).IsSuccessStatusCode);
        detail = await Json(await memberClient.GetAsync($"/api/forum/{discussionId}")); var replyId = detail["discussion"]!["comments"]![0]!["id"]!.GetValue<string>();
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.DeleteAsync($"/api/forum/{discussionId}/comments/{replyId}")).StatusCode);
        Assert.True((await adminClient.PatchAsJsonAsync($"/api/forum/{discussionId}/pin", new { pinned = true, version = detail["discussion"]!["version"]!.GetValue<uint>() })).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await adminClient.PatchAsJsonAsync($"/api/forum/{discussionId}/pin", new { pinned = false, version = detail["discussion"]!["version"]!.GetValue<uint>() })).StatusCode);
        var target = await Json(await adminClient.PostAsJsonAsync("/api/categories", new { name = "Training" }));
        var delete = new HttpRequestMessage(HttpMethod.Delete, $"/api/categories/{category.Id}") { Content = JsonContent.Create(new { replacement = target["id"]!.GetValue<string>(), version = category.Version }) };
        Assert.True((await adminClient.SendAsync(delete)).IsSuccessStatusCode);
        detail = await Json(await memberClient.GetAsync($"/api/forum/{discussionId}")); Assert.Equal(target["id"]!.GetValue<string>(), detail["discussion"]!["categoryId"]!.GetValue<string>());
        using var bitmap = new SKBitmap(2, 2); bitmap.Erase(SKColors.Green); using var encoded = SKImage.FromBitmap(bitmap).Encode(SKEncodedImageFormat.Png, 100);
        using var form = new MultipartFormDataContent(); form.Add(new ByteArrayContent(encoded.ToArray()), "file", "test.png");
        var image = await Json(await memberClient.PostAsync("/api/images", form)); Assert.True((await memberClient.GetAsync(image["src"]!.GetValue<string>())).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await otherClient.GetAsync(image["src"]!.GetValue<string>())).StatusCode);
        Assert.True((await memberClient.PostAsJsonAsync($"/api/forum/{discussionId}/comments", new { content = "<p>Image reply</p>", images = new[] { image } })).IsSuccessStatusCode);
        detail = await Json(await memberClient.GetAsync($"/api/forum/{discussionId}"));
        var imageReply = detail["discussion"]!["comments"]!.AsArray().Single(r => r!["images"]!.AsArray().Count == 1)!;
        Assert.True((await memberClient.DeleteAsync($"/api/forum/{discussionId}/comments/{imageReply["id"]}")).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await memberClient.GetAsync(image["src"]!.GetValue<string>())).StatusCode);
        using var nextForm = new MultipartFormDataContent(); nextForm.Add(new ByteArrayContent(encoded.ToArray()), "file", "discussion.png");
        image = await Json(await memberClient.PostAsync("/api/images", nextForm));
        Assert.True((await memberClient.PatchAsJsonAsync($"/api/forum/{discussionId}", new { title = "Training with image", content = "<p>Attached</p>", categoryId = target["id"]!.GetValue<string>(), images = new[] { image }, version = detail["discussion"]!["version"]!.GetValue<uint>() })).IsSuccessStatusCode);
        using var badForm = new MultipartFormDataContent(); badForm.Add(new StringContent("<svg onload='evil()'></svg>"), "file", "fake.png"); Assert.Equal(HttpStatusCode.BadRequest, (await memberClient.PostAsync("/api/images", badForm)).StatusCode);
        var draft = await Json(await adminClient.PostAsJsonAsync("/api/posts", new { titlePl = "Draft", titleEn = "Draft", contentPl = "Private", contentEn = "Private", status = "draft", important = false }));
        Assert.Equal(HttpStatusCode.NotFound, (await memberClient.GetAsync($"/api/posts/{draft["id"]}")).StatusCode);
        // New app host reads the same database; no in-memory repository is involved.
        await using (var restarted = new TestApi(connection)) { var client = await Login(restarted, members[0].Email, password); Assert.True((await client.GetAsync($"/api/forum/{discussionId}")).IsSuccessStatusCode); }
        Assert.True((await adminClient.DeleteAsync($"/api/forum/{discussionId}")).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await memberClient.GetAsync(image["src"]!.GetValue<string>())).StatusCode);
        Assert.True((await memberClient.PostAsync("/api/auth/logout", null)).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await memberClient.GetAsync("/api/bookings")).StatusCode);
        Assert.True(await setup.Audit.AnyAsync(a => a.Action == "forum.pin"));
        await setup.Database.EnsureDeletedAsync();
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
        var client = factory.CreateClient(); await Csrf(client); await Json(await client.PostAsJsonAsync("/api/auth/login", new { email, password })); await Csrf(client); return client;
    }
    private static async Task Csrf(HttpClient client) { var token = await Json(await client.GetAsync("/api/auth/csrf")); client.DefaultRequestHeaders.Remove("X-CSRF-Token"); client.DefaultRequestHeaders.Add("X-CSRF-Token", token["token"]!.GetValue<string>()); }
    private static async Task<JsonNode> Json(HttpResponseMessage response) { var body = await response.Content.ReadAsStringAsync(); Assert.True(response.IsSuccessStatusCode, $"HTTP {(int)response.StatusCode}: {body}"); return JsonNode.Parse(body)!; }
}
public sealed class TestApi(string connection) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureServices(services => { services.RemoveAll<DbContextOptions<GymDb>>(); services.RemoveAll<GymDb>(); services.AddDbContext<GymDb>(o => o.UseNpgsql(connection)); });
    }
}
