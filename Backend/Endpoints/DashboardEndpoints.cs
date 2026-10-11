using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace LiftTogether.Api.Endpoints;

public static class DashboardEndpoints
{
    private static readonly TimeZoneInfo GymTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");

    public static void MapDashboard(this WebApplication app)
    {
        app.MapGet("/api/dashboard", async (GymDb db, CancellationToken cancellationToken) =>
        {
            var today = Rules.Today();
            var from = Monday(today);
            var start = Midnight(from);
            var end = Midnight(from.AddDays(7));
            var now = DateTimeOffset.UtcNow;
            var topics = db.Discussions.AsNoTracking().Where(topic => topic.CreatedAt >= start && topic.CreatedAt < end && topic.CreatedAt <= now);
            var news = db.Posts.AsNoTracking().Where(post => post.Status == "published" && post.CreatedAt >= start && post.CreatedAt < end && post.CreatedAt <= now);
            return new
            {
                from = from.ToString("yyyy-MM-dd"),
                to = from.AddDays(6).ToString("yyyy-MM-dd"),
                forumTopics = await topics.CountAsync(cancellationToken),
                forumReplies = await db.Replies.CountAsync(reply => reply.CreatedAt >= start && reply.CreatedAt < end && reply.CreatedAt <= now, cancellationToken),
                newsPosts = await news.CountAsync(cancellationToken),
                latestTopics = await topics.OrderByDescending(topic => topic.CreatedAt).ThenByDescending(topic => topic.Id)
                    .Take(2).Select(topic => new { topic.Id, topic.Title }).ToListAsync(cancellationToken),
                latestNews = await news.OrderByDescending(post => post.CreatedAt).ThenByDescending(post => post.Id)
                    .Take(2).Select(post => new { post.Id, post.TitlePl, post.TitleEn }).ToListAsync(cancellationToken)
            };
        }).RequireAuthorization("verified");

        app.MapGet("/api/admin/statistics", async (string? period, string? date, GymDb db, CancellationToken cancellationToken) =>
        {
            period ??= "week";
            Rules.Require(period is "week" or "month");
            var anchor = Rules.Today();
            if (date != null)
            {
                Rules.Require(DateOnly.TryParseExact(date, "yyyy-MM-dd", out anchor));
                Rules.Require(anchor.Year is >= 2000 and <= 2100);
            }
            var from = period == "week" ? Monday(anchor) : new DateOnly(anchor.Year, anchor.Month, 1);
            var until = period == "week" ? from.AddDays(7) : from.AddMonths(1);
            var start = Midnight(from);
            var end = Midnight(until);
            var bookings = db.Bookings.AsNoTracking().Where(booking => booking.Date >= from && booking.Date < until);
            var active = bookings.Where(booking => !booking.Cancelled);
            var dailyCounts = await active.GroupBy(booking => booking.Date)
                .Select(group => new { Date = group.Key, Count = group.Select(booking => booking.UserId).Distinct().Count() })
                .ToDictionaryAsync(day => day.Date, day => day.Count, cancellationToken);
            var daily = Enumerable.Range(0, until.DayNumber - from.DayNumber).Select(offset =>
            {
                var day = from.AddDays(offset);
                return new { Date = day.ToString("yyyy-MM-dd"), Weekday = (int)day.DayOfWeek, Bookings = dailyCounts.GetValueOrDefault(day) };
            }).ToArray();
            // Include quiet days in the denominator; otherwise averages are inflated.
            var weekdays = daily.GroupBy(day => day.Weekday).Select(group => new
            {
                Weekday = group.Key,
                Average = Math.Round(group.Average(day => day.Bookings), 2),
                Bookings = group.Sum(day => day.Bookings),
                Days = group.Count()
            }).OrderBy(day => (day.Weekday + 6) % 7).ToArray();
            var busiest = weekdays.Where(day => day.Bookings > 0).OrderByDescending(day => day.Average)
                .ThenBy(day => (day.Weekday + 6) % 7).FirstOrDefault();
            return new
            {
                period,
                from = from.ToString("yyyy-MM-dd"),
                to = until.AddDays(-1).ToString("yyyy-MM-dd"),
                totalUsers = await db.Members.CountAsync(cancellationToken),
                verifiedMembers = await db.Members.CountAsync(member => member.Role == "user" && member.Verified, cancellationToken),
                pendingMembers = await db.Members.CountAsync(member => member.Role == "user" && !member.Verified, cancellationToken),
                forumTopics = await db.Discussions.CountAsync(cancellationToken),
                periodForumTopics = await db.Discussions.CountAsync(topic => topic.CreatedAt >= start && topic.CreatedAt < end, cancellationToken),
                periodNewsPosts = await db.Posts.CountAsync(post => post.Status == "published" && post.CreatedAt >= start && post.CreatedAt < end, cancellationToken),
                bookings = await active.CountAsync(cancellationToken),
                cancelledBookings = await bookings.CountAsync(booking => booking.Cancelled, cancellationToken),
                trainingMembers = await active.Select(booking => booking.UserId).Distinct().CountAsync(cancellationToken),
                averageDailyBookings = Math.Round(daily.Average(day => day.Bookings), 2),
                busiestWeekday = busiest?.Weekday,
                capacity = await db.Settings.Select(settings => settings.MaxDaily).SingleAsync(cancellationToken),
                daily,
                weekdays
            };
        }).RequireAuthorization("admin");
    }

    private static DateOnly Monday(DateOnly date) => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));

    private static DateTimeOffset Midnight(DateOnly date) =>
        new(TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue), GymTimeZone));
}
