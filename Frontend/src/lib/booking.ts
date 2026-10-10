import type { Booking } from "../types";
import { minutes, dateFromIso, toIsoDate } from "./date.ts";
export function dailyOccupancy(bookings: Booking[], date: string) {
  return new Set(
    bookings
      .filter((b) => b.date === date && !b.cancelled)
      .map((b) => b.userId),
  ).size;
}
export function peakConcurrent(bookings: Booking[], date: string) {
  const events = bookings
    .filter((b) => b.date === date && !b.cancelled)
    .flatMap((b) => [
      [minutes(b.start), 1],
      [minutes(b.end), -1],
    ]);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let count = 0,
    peak = 0;
  for (const [, delta] of events) {
    count += delta;
    peak = Math.max(peak, count);
  }
  return peak;
}
export function bookingError(
  bookings: Booking[],
  candidate: Pick<Booking, "date" | "start" | "end"> & { userId?: string },
  capacity: number,
  excludedId?: number,
): string | null {
  const time = /^(?:[01]\d|2[0-3]):(?:00|30)$/;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(candidate.date) ||
    toIsoDate(dateFromIso(candidate.date)) !== candidate.date ||
    !time.test(candidate.start) ||
    !(time.test(candidate.end) || candidate.end === "24:00")
  )
    return "Invalid date or time.";
  const start = minutes(candidate.start),
    end = minutes(candidate.end);
  if (start < 360 || end - start < 30 || end - start > 180)
    return "Choose 30–180 minutes between 06:00 and 24:00.";
  if (!Number.isInteger(capacity) || capacity < 1) return "Invalid capacity.";
  const daily = bookings.filter(
    (b) => b.id !== excludedId && b.date === candidate.date && !b.cancelled,
  );
  const people = new Set(daily.map((b) => b.userId));
  return (!candidate.userId || !people.has(candidate.userId)) &&
    people.size >= capacity
    ? "The daily limit is full. Choose another day."
    : null;
}
