import { dateFromIso, minutes } from "../../lib/date.ts";
import { requireValue, paginate, type MemberContext } from "./state.ts";

export function handleProfile({
  state,
  user,
  method,
  path,
  page,
}: MemberContext) {
  requireValue(method === "GET");
  const bookings = state.bookings.filter(
    (booking) => booking.userId === user.id,
  );
  if (path === "profile/trainings") {
    const result = paginate(
      bookings.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
      page,
    );
    return { bookings: result.items, page, hasMore: result.hasMore };
  }
  requireValue(path === "profile/stats", "NOT_FOUND", 404);
  const active = bookings.filter((booking) => !booking.cancelled);
  const completed = active.filter((booking) => booking.completedAt);
  const topics = state.discussions.filter((topic) => topic.userId === user.id);
  const popular =
    topics
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        replies: topic.comments.filter((reply) => reply.userId !== user.id)
          .length,
      }))
      .sort((a, b) => b.replies - a.replies || a.id.localeCompare(b.id))[0] ??
    null;
  return {
    completedTrainings: completed.length,
    trainingMinutes: completed.reduce(
      (sum, booking) => sum + minutes(booking.end) - minutes(booking.start),
      0,
    ),
    scheduledBookings: active.length,
    cancelledBookings: bookings.filter((booking) => booking.cancelled).length,
    forumPosts: topics.length,
    forumComments: state.discussions.reduce(
      (sum, topic) =>
        sum + topic.comments.filter((reply) => reply.userId === user.id).length,
      0,
    ),
    mostPopularPost: popular,
    weekdays: Array.from({ length: 7 }, (_, weekday) => {
      const days = bookings.filter(
        (booking) => dateFromIso(booking.date).getDay() === weekday,
      );
      const scheduled = days.filter((booking) => !booking.cancelled).length;
      return {
        weekday,
        scheduled,
        cancelled: days.filter((booking) => booking.cancelled).length,
        completed: days.filter(
          (booking) => !booking.cancelled && booking.completedAt,
        ).length,
        percentage: active.length
          ? Math.round((1000 * scheduled) / active.length) / 10
          : 0,
      };
    }),
  };
}
