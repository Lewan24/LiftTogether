using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
namespace LiftTogether.Api.Endpoints;

public static class GymEndpoints
{
    public static void MapGym(this WebApplication app)
    {
        app.MapGet("/api/public", async (GymDb db, CancellationToken cancellationToken) => Dto.Settings(await db.Settings.AsNoTracking().SingleAsync(cancellationToken)));
        app.MapGet("/api/users", async (int? page, string? role, GymDb db, CancellationToken cancellationToken) =>
        {
            var pageNumber = Page(page);
            Rules.Require(role is null or "admin" or "user");
            var users = await db.Members.AsNoTracking().Where(x => role == null || x.Role == role).OrderBy(x => x.Verified).ThenBy(x => x.Id).Skip(pageNumber * 50).Take(51)
                .ToListAsync(cancellationToken);
            return new
            {
                users = users.Take(50).Select(Dto.AdminUser),
                page = pageNumber,
                hasMore = users.Count > 50
            };
        })
            .RequireAuthorization("admin");
        app.MapPost("/api/users", async (AdminMemberInput input, HttpContext context, GymDb db, IPasswordHasher<Member> hasher, CancellationToken cancellationToken) =>
            await SaveMember(null, input, context, db, hasher, cancellationToken))
            .RequireAuthorization("admin");
        app.MapPatch("/api/users/{id:guid}", async (Guid id, AdminMemberInput input, HttpContext context, GymDb db, IPasswordHasher<Member> hasher, CancellationToken cancellationToken) =>
            await SaveMember(id, input, context, db, hasher, cancellationToken))
            .RequireAuthorization("admin");
        app.MapPatch("/api/users/{id:guid}/verification", async (Guid id, VerifyInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var member = await db.Members.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
            Rules.Version(input.Version, member.Version);
            Rules.Require(member.Role != "admin", "ADMIN_VERIFICATION", 400);
            member.Verified = input.Verified;
            db.Record(context.User.UserId(), "member.verify", id);
            await db.SaveChangesAsync(cancellationToken);
            return Dto.AdminUser(member);
        })
            .RequireAuthorization("admin");
        app.MapPatch("/api/settings", async (SettingsInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var settings = await db.Settings.SingleAsync(cancellationToken);
            Rules.Version(input.Version, settings.Version);
            settings.GymName = Rules.Text(input.GymName, 100);
            settings.DormitoryName = Rules.Text(input.DormitoryName, 100);
            Rules.Require(input.MaxDaily is >= 1 and <= 100 && input.DefaultCalendarView is "week" or "month");
            settings.MaxDaily = input.MaxDaily;
            settings.RegistrationEnabled = input.RegistrationEnabled;
            settings.DefaultCalendarView = input.DefaultCalendarView;
            Rules.Require(input.NextWeekReleaseDay is >= 0 and <= 6);
            Rules.Require(TimeOnly.TryParseExact(input.NextWeekReleaseTime, "HH:mm", out _));
            settings.NextWeekReleaseDay = input.NextWeekReleaseDay;
            settings.NextWeekReleaseTime = input.NextWeekReleaseTime;
            db.Record(context.User.UserId(), "settings.update", settings.Id);
            await db.SaveChangesAsync(cancellationToken);
            return Dto.Settings(settings);
        })
            .RequireAuthorization("admin");
        var bookingRoutes = app.MapGroup("/api/bookings").RequireAuthorization("verified");
        bookingRoutes.MapGet("", async (string? from, string? to, GymDb db, CancellationToken cancellationToken) =>
        {
            var start = ParseDate(from) ?? Rules.Today().AddDays(-7);
            var end = ParseDate(to) ?? start.AddDays(42);
            Rules.Require(end >= start && end.DayNumber - start.DayNumber <= 92, "INVALID_DATE_RANGE");
            var all = await db.Bookings.AsNoTracking().Include(x => x.User).Where(x => x.Date >= start && x.Date <= end)
                .OrderBy(x => x.Date)
                .ThenBy(x => x.StartMinute)
                .Take(10000)
                .ToListAsync(cancellationToken);
            return all.Select(Dto.Booking);
        });
        bookingRoutes.MapPost("", async (BookingInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) => await SaveBooking(null, input, context, db, cancellationToken));
        bookingRoutes.MapPatch("/{id:long}", async (long id, BookingInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) => await SaveBooking(id, input, context, db, cancellationToken));
        bookingRoutes.MapPost("/{id:long}/cancel", async (long id, VersionInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var booking = await db.Bookings.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
            Owner(context, booking);
            Rules.Version(input.Version, booking.Version);
            var settings = await db.Settings.AsNoTracking().SingleAsync(cancellationToken);
            Rules.Require(context.User.Admin() || Rules.BookingWindow(booking.Date, settings), "BOOKING_WINDOW_CLOSED", 403);
            Rules.Require(booking.CompletedAt == null, "TRAINING_ALREADY_COMPLETED", 409);
            booking.Cancelled = true;
            db.Record(context.User.UserId(), "booking.cancel", id);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });
        bookingRoutes.MapPost("/{id:long}/complete", async (long id, VersionInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var booking = await db.Bookings.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
            Owner(context, booking);
            Rules.Version(input.Version, booking.Version);
            TrainingStats.RequireCompletable(booking, DateTimeOffset.UtcNow);
            booking.CompletedAt = DateTimeOffset.UtcNow;
            db.Record(context.User.UserId(), "booking.complete", id);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });
        bookingRoutes.MapDelete("/{id:long}", async (long id, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var item = await db.Bookings.FindAsync([id], cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
            db.Bookings.Remove(item);
            db.Record(context.User.UserId(), "booking.delete", id);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequireAuthorization("admin");
        app.MapGet("/api/audit", async (int? page, GymDb db, CancellationToken cancellationToken) =>
        {
            var pageNumber = Page(page);
            var entries = await (
                from entry in db.Audit.AsNoTracking()
                join member in db.Members.AsNoTracking() on entry.ActorId equals member.Id into actors
                from actor in actors.DefaultIfEmpty()
                orderby entry.Id descending
                select new
                {
                    entry.Id, entry.ActorId, entry.Action, entry.Target, entry.CreatedAt,
                    ActorName = actor == null ? "System" : actor.FirstName + " " + actor.LastName
                }).Skip(pageNumber * 50).Take(51).ToListAsync(cancellationToken);
            return new { entries = entries.Take(50), page = pageNumber, hasMore = entries.Count > 50 };
        })
            .RequireAuthorization("admin");
    }
    private static async Task<object> SaveMember(Guid? id, AdminMemberInput input, HttpContext context, GymDb db, IPasswordHasher<Member> hasher, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        // Serialize role changes so concurrent demotions cannot remove every administrator.
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(1279874129)", cancellationToken);
        Rules.Require(await db.Members.AnyAsync(x => x.Id == context.User.UserId() && x.Role == "admin", cancellationToken), "FORBIDDEN", 403);
        var member = id.HasValue
            ? await db.Members.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND")
            : new Member();
        if (id.HasValue) Rules.Version(input.Version, member.Version);
        var role = input.Role ?? member.Role;
        Rules.Require(role is "admin" or "user");
        Rules.Require(role != "admin" || input.Verified, "ADMIN_VERIFICATION");
        var roleChanged = member.Role != role;
        if (member.Role == "admin" && role == "user")
            Rules.Require(await db.Members.AnyAsync(x => x.Id != member.Id && x.Role == "admin", cancellationToken), "LAST_ADMIN", 409);
        if (roleChanged)
        {
            db.Record(context.User.UserId(), "member.role", System.Text.Json.JsonSerializer.Serialize(new { accountId = member.Id, previousRole = member.Role, role }));
            await db.Sessions.Where(x => x.UserId == member.Id).ExecuteDeleteAsync(cancellationToken);
        }
        member.Role = role;
        Rules.Profile(member, input.FirstName, input.LastName, input.Email, input.Dormitory, input.Room, input.FacebookUrl, input.Phone);
        Rules.Require(!await db.Members.AnyAsync(x => x.Email == member.Email && x.Id != member.Id, cancellationToken), "EMAIL_IN_USE", 409);
        if (input.AdminNotes != null) member.AdminNotes = Rules.Text(input.AdminNotes, 4000, false);
        member.Verified = input.Verified;
        if (!id.HasValue || !string.IsNullOrEmpty(input.Password))
        {
            Rules.Password(input.Password);
            member.PasswordHash = hasher.HashPassword(member, input.Password!);
            await db.Sessions.Where(x => x.UserId == member.Id).ExecuteDeleteAsync(cancellationToken);
        }
        if (!id.HasValue) db.Members.Add(member);
        db.Record(context.User.UserId(), id.HasValue ? "member.update" : "member.create", member.Id);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Dto.AdminUser(member);
    }
    public static int Page(int? page)
    {
        Rules.Require(page is null or >= 0 and <= 10000);
        return page ?? 0;
    }
    private static DateOnly? ParseDate(string? value)
    {
        if (value == null) return null;
        Rules.Require(DateOnly.TryParseExact(value, "yyyy-MM-dd", out var parsed));
        return parsed;
    }
    private static void Owner(HttpContext context, Booking b) => Rules.Require(context.User.Admin() || b.UserId == context.User.UserId(), "FORBIDDEN", 403);
    private static async Task<object> SaveBooking(long? id, BookingInput input, HttpContext context, GymDb db, CancellationToken cancellationToken)
    {
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var settings = await db.Settings.FromSqlRaw("SELECT *, xmin FROM \"Settings\" WHERE \"Id\" = 1 FOR SHARE")
            .SingleAsync(cancellationToken);
        var (date, start, end) = Rules.Booking(input, context.User.Admin(), settings);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({date.DayNumber})", cancellationToken);
        var booking = id.HasValue ? await db.Bookings.Include(x => x.User).SingleOrDefaultAsync(x => x.Id == id, cancellationToken) : await db.Bookings.Include(x => x.User)
            .SingleOrDefaultAsync(x => x.UserId == context.User.UserId() && x.Date == date, cancellationToken);
        if (id.HasValue && booking == null) throw new ApiFault(404, "NOT_FOUND");
        if (booking != null)
        {
            Owner(context, booking);
            Rules.Version(input.Version, booking.Version);
            Rules.Require(booking.CompletedAt == null, "TRAINING_ALREADY_COMPLETED", 409);
            Rules.Require(booking.Date == date, "BOOKING_DATE_IMMUTABLE");
        }
        var owner = booking?.UserId ?? context.User.UserId();
        var count = await db.Bookings.Where(x => x.Date == date && !x.Cancelled && x.UserId != owner).Select(x => x.UserId)
            .Distinct()
            .CountAsync(cancellationToken);
        Rules.Require(count < settings.MaxDaily, "DAILY_CAPACITY_FULL", 409);
        if (booking == null)
        {
            booking = new Booking
            {
                UserId = owner,
                User = await db.Members.SingleAsync(x => x.Id == owner, cancellationToken),
                Date = date
            };
            db.Bookings.Add(booking);
        }
        booking.StartMinute = start;
        booking.EndMinute = end;
        booking.Cancelled = false;
        db.Record(context.User.UserId(), "booking.save", date);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return Dto.Booking(booking);
    }
}
