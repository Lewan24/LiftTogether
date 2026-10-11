import {
  addDays,
  dateFromIso,
  gymToday,
  startOfWeek,
  toIsoDate,
} from "../../lib/date.ts";
import { requireValue, type MemberContext } from "./state.ts";

export function handleDashboard({
  state,
  path,
  query,
  user,
  method,
}: MemberContext) {
  requireValue(method === "GET", "NOT_FOUND", 404);
  const period = path === "dashboard" ? "week" : String(query.period ?? "week");
  requireValue(period === "week" || period === "month");
  const anchor = String(
    (path === "dashboard" ? undefined : query.date) ?? gymToday(),
  );
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(anchor));
  const date = dateFromIso(anchor);
  requireValue(
    toIsoDate(date) === anchor &&
      date.getFullYear() >= 2000 &&
      date.getFullYear() <= 2100,
  );
  const from =
    period === "week"
      ? startOfWeek(date)
      : new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const until =
    period === "week"
      ? addDays(from, 7)
      : new Date(from.getFullYear(), from.getMonth() + 1, 1, 12);
  const fromIso = toIsoDate(from);
  const untilIso = toIsoDate(until);
  const within = (timestamp: string) => {
    const day = gymToday(new Date(timestamp));
    return day >= fromIso && day < untilIso;
  };
  const topics = state.discussions.filter((topic) => within(topic.createdAt));
  const news = state.posts.filter(
    (post) => post.status === "published" && within(post.createdAt),
  );
  if (path === "dashboard") {
    const now = new Date().toISOString();
    const visibleTopics = topics.filter((topic) => topic.createdAt <= now);
    const visibleNews = news.filter((post) => post.createdAt <= now);
    return {
      from: fromIso,
      to: toIsoDate(addDays(until, -1)),
      forumTopics: visibleTopics.length,
      forumReplies: state.discussions
        .flatMap((topic) => topic.comments)
        .filter((reply) => within(reply.createdAt) && reply.createdAt <= now)
        .length,
      newsPosts: visibleNews.length,
      latestTopics: [...visibleTopics]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 2)
        .map((topic) => ({ id: topic.id, title: topic.title })),
      latestNews: [...visibleNews]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 2)
        .map((post) => ({
          id: post.id,
          titlePl: post.titlePl,
          titleEn: post.titleEn,
        })),
    };
  }
  requireValue(user.role === "admin", "FORBIDDEN", 403);
  const bookings = state.bookings.filter(
    (booking) => booking.date >= fromIso && booking.date < untilIso,
  );
  const active = bookings.filter((booking) => !booking.cancelled);
  const daily: { date: string; weekday: number; bookings: number }[] = [];
  for (let day = from; day < until; day = addDays(day, 1)) {
    const iso = toIsoDate(day);
    daily.push({
      date: iso,
      weekday: day.getDay(),
      bookings: new Set(
        active
          .filter((booking) => booking.date === iso)
          .map((booking) => booking.userId),
      ).size,
    });
  }
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const days = daily.filter((day) => day.weekday === weekday);
    const count = days.reduce((sum, day) => sum + day.bookings, 0);
    return {
      weekday,
      average: Math.round((count / days.length) * 100) / 100,
      bookings: count,
      days: days.length,
    };
  });
  const busiest = [...weekdays]
    .filter((day) => day.bookings > 0)
    .sort((a, b) => b.average - a.average)[0];
  return {
    period,
    from: fromIso,
    to: toIsoDate(addDays(until, -1)),
    totalUsers: state.users.length,
    verifiedMembers: state.users.filter(
      (member) => member.role === "user" && member.verified,
    ).length,
    pendingMembers: state.users.filter(
      (member) => member.role === "user" && !member.verified,
    ).length,
    forumTopics: state.discussions.length,
    periodForumTopics: topics.length,
    periodNewsPosts: news.length,
    bookings: active.length,
    cancelledBookings: bookings.length - active.length,
    trainingMembers: new Set(active.map((booking) => booking.userId)).size,
    averageDailyBookings:
      Math.round(
        (daily.reduce((sum, day) => sum + day.bookings, 0) / daily.length) *
          100,
      ) / 100,
    busiestWeekday: busiest?.weekday ?? null,
    capacity: state.settings.maxDaily,
    daily,
    weekdays,
  };
}
