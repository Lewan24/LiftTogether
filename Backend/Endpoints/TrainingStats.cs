using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace LiftTogether.Api.Endpoints;

public static class TrainingStats
{
    private static readonly TimeZoneInfo GymZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");

    public static void RequireCompletable(Booking booking, DateTimeOffset now)
    {
        var local = TimeZoneInfo.ConvertTime(now, GymZone);
        var today = DateOnly.FromDateTime(local.DateTime);
        Rules.Require(!booking.Cancelled && booking.CompletedAt == null, "TRAINING_UNAVAILABLE", 409);
        Rules.Require(booking.Date < today || (booking.Date == today && booking.EndMinute <= local.Hour * 60 + local.Minute), "TRAINING_NOT_FINISHED", 409);
    }

    public static void MapTrainingStats(this WebApplication app)
    {
        app.MapGet("/api/profile/stats", async (HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            // Never accept a user ID from the client: these are private, own-account statistics.
            var userId = context.User.UserId();
            var bookings = db.Bookings.AsNoTracking().Where(x => x.UserId == userId);
            // PostgreSQL aggregates all history into at most seven rows.
            var days = await bookings.GroupBy(x => x.Date.DayOfWeek).Select(g => new
            {
                Weekday = (int)g.Key,
                Scheduled = g.Count(x => !x.Cancelled),
                Cancelled = g.Count(x => x.Cancelled),
                Completed = g.Count(x => x.CompletedAt != null && !x.Cancelled),
                Minutes = g.Sum(x => x.CompletedAt != null && !x.Cancelled ? x.EndMinute - x.StartMinute : 0)
            }).ToListAsync(cancellationToken);
            var scheduled = days.Sum(x => x.Scheduled);
            var topics = db.Discussions.AsNoTracking().Where(x => x.UserId == userId);
            var popular = await topics.Select(x => new
            {
                x.Id, x.Title, Replies = db.Replies.Count(reply => reply.DiscussionId == x.Id && reply.UserId != userId)
            }).OrderByDescending(x => x.Replies).ThenBy(x => x.Id).FirstOrDefaultAsync(cancellationToken);
            return new
            {
                CompletedTrainings = days.Sum(x => x.Completed),
                TrainingMinutes = days.Sum(x => x.Minutes),
                ScheduledBookings = scheduled,
                CancelledBookings = days.Sum(x => x.Cancelled),
                ForumPosts = await topics.CountAsync(cancellationToken),
                ForumComments = await db.Replies.CountAsync(x => x.UserId == userId, cancellationToken),
                MostPopularPost = popular,
                Weekdays = Enumerable.Range(0, 7).Select(weekday => new
                {
                    Weekday = weekday,
                    Scheduled = days.Where(x => x.Weekday == weekday).Sum(x => x.Scheduled),
                    Cancelled = days.Where(x => x.Weekday == weekday).Sum(x => x.Cancelled),
                    Completed = days.Where(x => x.Weekday == weekday).Sum(x => x.Completed),
                    Percentage = scheduled == 0 ? 0 : Math.Round(100.0 * days.Where(x => x.Weekday == weekday).Sum(x => x.Scheduled) / scheduled, 1)
                })
            };
        }).RequireAuthorization("verified");
        app.MapGet("/api/profile/trainings", async (int? page, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var pageNumber = GymEndpoints.Page(page);
            var userId = context.User.UserId();
            var bookings = await db.Bookings.AsNoTracking().Include(x => x.User)
                .Where(x => x.UserId == userId).OrderByDescending(x => x.Date).ThenByDescending(x => x.Id)
                .Skip(pageNumber * 50).Take(51).ToListAsync(cancellationToken);
            return new { Bookings = bookings.Take(50).Select(Dto.Booking), Page = pageNumber, HasMore = bookings.Count > 50 };
        }).RequireAuthorization("verified");
    }
}
