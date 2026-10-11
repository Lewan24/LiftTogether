import {
  name,
  initials,
  requireValue,
  text,
  version,
  nextId,
  find,
  remove,
  type MemberContext,
} from "./state.ts";
import { isBookableDate, minutes } from "../../lib/date.ts";

export async function handleBookings(context: MemberContext): Promise<unknown> {
  const { state, method, body, query, parts, user } = context;
  const admin = () => requireValue(user.role === "admin", "FORBIDDEN", 403);
  const owner = (id: string) =>
    requireValue(user.role === "admin" || user.id === id, "FORBIDDEN", 403);
  if (method === "GET")
    return state.bookings.filter(
      (b) =>
        (!query.from || b.date >= String(query.from)) &&
        (!query.to || b.date <= String(query.to)),
    );
  if (method === "DELETE") {
    admin();
    remove(state.bookings, find(state.bookings, parts[1]));
    return null;
  }
  const booking = parts[1]
    ? find(state.bookings, parts[1])
    : state.bookings.find((b) => b.userId === user.id && b.date === body.date);
  if (booking) {
    owner(booking.userId);
    version(body, booking);
  }
  if (parts[2] === "cancel" && method === "POST") {
    requireValue(booking);
    requireValue(
      user.role === "admin" || isBookableDate(booking.date, state.settings),
      "BOOKING_WINDOW_CLOSED",
      403,
    );
    booking.cancelled = true;
    booking.version++;
    return null;
  }
  requireValue(method === "POST" || method === "PATCH");
  const date = text(body.date, 10);
  const start = text(body.start, 5);
  const end = text(body.end, 5);
  requireValue(
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start) &&
      (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end) || end === "24:00"),
  );
  const parsedDate = new Date(`${date}T12:00:00Z`);
  requireValue(
    !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === date,
  );
  const startMinute = minutes(start);
  const endMinute = minutes(end);
  requireValue(
    startMinute >= 360 &&
      endMinute <= 1440 &&
      endMinute - startMinute >= 30 &&
      endMinute - startMinute <= 180 &&
      startMinute % 30 === 0 &&
      endMinute % 30 === 0,
    "INVALID_BOOKING_TIME",
  );
  requireValue(
    user.role === "admin" || isBookableDate(date, state.settings),
    "BOOKING_WINDOW_CLOSED",
    403,
  );
  requireValue(!booking || booking.date === date, "BOOKING_DATE_IMMUTABLE");
  const userId = booking?.userId ?? user.id;
  requireValue(
    state.bookings.filter(
      (b) => b.date === date && !b.cancelled && b.userId !== userId,
    ).length < state.settings.maxDaily,
    "DAILY_CAPACITY_FULL",
    409,
  );
  if (booking) {
    Object.assign(booking, {
      start,
      end,
      cancelled: false,
      version: booking.version + 1,
    });
    return booking;
  }
  const created = {
    id: nextId(state.bookings),
    userId,
    date,
    start,
    end,
    cancelled: false,
    version: 1,
    color: "green",
    name: name(user),
    initials: initials(user),
  };
  state.bookings.push(created);
  return created;
}
