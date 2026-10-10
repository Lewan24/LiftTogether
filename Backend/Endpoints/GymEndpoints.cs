using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.EntityFrameworkCore;
namespace LiftTogether.Api.Endpoints;

public static class GymEndpoints
{
    public static void MapGym(this WebApplication app)
    {
        app.MapGet("/api/public", async (GymDb db, CancellationToken ct) => Dto.Settings(await db.Settings.AsNoTracking().SingleAsync(ct)));
        app.MapGet("/api/users", async (int? page, GymDb db, CancellationToken ct) => { var p = Page(page); var users = await db.Members.AsNoTracking().OrderBy(x => x.Verified).ThenBy(x => x.Id).Skip(p * 50).Take(51).ToListAsync(ct); return new { users = users.Take(50).Select(Dto.User), page = p, hasMore = users.Count > 50 }; }).RequireAuthorization("admin");
        app.MapPatch("/api/users/{id:guid}/verification", async (Guid id, VerifyInput input, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            var u = await db.Members.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiFault(404, "NOT_FOUND"); Rules.Version(input.Version, u.Version); Rules.Require(u.Role != "admin", "ADMIN_VERIFICATION", 400); u.Verified = input.Verified; db.Record(c.User.UserId(), "member.verify", id); await db.SaveChangesAsync(ct); return Dto.User(u);
        }).RequireAuthorization("admin");
        app.MapPatch("/api/settings", async (SettingsInput input, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            var s = await db.Settings.SingleAsync(ct); Rules.Version(input.Version, s.Version); s.GymName = Rules.Text(input.GymName, 100); s.DormitoryName = Rules.Text(input.DormitoryName, 100); Rules.Require(input.MaxDaily is >= 1 and <= 100 && input.DefaultCalendarView is "week" or "month"); s.MaxDaily = input.MaxDaily; s.RegistrationEnabled = input.RegistrationEnabled; s.DefaultCalendarView = input.DefaultCalendarView; db.Record(c.User.UserId(), "settings.update", s.Id); await db.SaveChangesAsync(ct); return Dto.Settings(s);
        }).RequireAuthorization("admin");
        var b = app.MapGroup("/api/bookings").RequireAuthorization("verified");
        b.MapGet("", async (string? from, string? to, GymDb db, CancellationToken ct) =>
        {
            var start = ParseDate(from) ?? Rules.Today().AddDays(-7); var end = ParseDate(to) ?? start.AddDays(42); Rules.Require(end >= start && end.DayNumber - start.DayNumber <= 92, "INVALID_DATE_RANGE");
            var all = await db.Bookings.AsNoTracking().Include(x => x.User).Where(x => x.Date >= start && x.Date <= end).OrderBy(x => x.Date).ThenBy(x => x.StartMinute).Take(10000).ToListAsync(ct); return all.Select(Dto.Booking);
        });
        b.MapPost("", async (BookingInput input, HttpContext c, GymDb db, CancellationToken ct) => await SaveBooking(null, input, c, db, ct));
        b.MapPatch("/{id:long}", async (long id, BookingInput input, HttpContext c, GymDb db, CancellationToken ct) => await SaveBooking(id, input, c, db, ct));
        b.MapPost("/{id:long}/cancel", async (long id, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            var booking = await db.Bookings.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiFault(404, "NOT_FOUND"); Owner(c, booking); Rules.Require(c.User.Admin() || Rules.CurrentWeek(booking.Date), "CURRENT_WEEK_ONLY", 403); booking.Cancelled = true; db.Record(c.User.UserId(), "booking.cancel", id); await db.SaveChangesAsync(ct); return Results.NoContent();
        });
        b.MapDelete("/{id:long}", async (long id, HttpContext c, GymDb db, CancellationToken ct) => { var item = await db.Bookings.FindAsync([id], ct) ?? throw new ApiFault(404, "NOT_FOUND"); db.Bookings.Remove(item); db.Record(c.User.UserId(), "booking.delete", id); await db.SaveChangesAsync(ct); return Results.NoContent(); }).RequireAuthorization("admin");
        app.MapGet("/api/audit", async (int? page, GymDb db, CancellationToken ct) => await db.Audit.AsNoTracking().OrderByDescending(x => x.Id).Skip(Page(page) * 50).Take(50).ToListAsync(ct)).RequireAuthorization("admin");
    }
    public static int Page(int? page) { Rules.Require(page is null or >= 0 and <= 10000); return page ?? 0; }
    private static DateOnly? ParseDate(string? value) { if (value == null) return null; Rules.Require(DateOnly.TryParseExact(value, "yyyy-MM-dd", out var parsed)); return parsed; }
    private static void Owner(HttpContext c, Booking b) => Rules.Require(c.User.Admin() || b.UserId == c.User.UserId(), "FORBIDDEN", 403);
    private static async Task<object> SaveBooking(long? id, BookingInput input, HttpContext c, GymDb db, CancellationToken ct)
    {
        var (date, start, end) = Rules.Booking(input, c.User.Admin());
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var settings = await db.Settings.FromSqlRaw("SELECT *, xmin FROM \"Settings\" WHERE \"Id\" = 1 FOR SHARE").SingleAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({date.DayNumber})", ct);
        var booking = id.HasValue ? await db.Bookings.Include(x => x.User).SingleOrDefaultAsync(x => x.Id == id, ct) : await db.Bookings.Include(x => x.User).SingleOrDefaultAsync(x => x.UserId == c.User.UserId() && x.Date == date, ct);
        if (id.HasValue && booking == null) throw new ApiFault(404, "NOT_FOUND");
        if (booking != null) { Owner(c, booking); Rules.Version(input.Version, booking.Version); Rules.Require(booking.Date == date, "BOOKING_DATE_IMMUTABLE"); }
        var owner = booking?.UserId ?? c.User.UserId();
        var count = await db.Bookings.Where(x => x.Date == date && !x.Cancelled && x.UserId != owner).Select(x => x.UserId).Distinct().CountAsync(ct);
        Rules.Require(count < settings.MaxDaily, "DAILY_CAPACITY_FULL", 409);
        if (booking == null) { booking = new Booking { UserId = owner, User = await db.Members.SingleAsync(x => x.Id == owner, ct), Date = date }; db.Bookings.Add(booking); }
        booking.StartMinute = start; booking.EndMinute = end; booking.Cancelled = false; db.Record(c.User.UserId(), "booking.save", date); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto.Booking(booking);
    }
}
