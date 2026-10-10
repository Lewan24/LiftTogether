import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingError, dailyOccupancy } from "../src/lib/booking.ts";
import { safeProfileUrl } from "../src/lib/validation.ts";
const b = (id: number, start: string, end: string) => ({
  id,
  userId: `u-${id}`,
  date: "2026-10-08",
  start,
  end,
  name: "Demo",
  initials: "D",
  color: "green",
});
test("daily capacity includes people with non-overlapping sessions", () => {
  const bookings = [b(1, "07:00", "08:00"), b(2, "08:00", "09:00")];
  assert.equal(dailyOccupancy(bookings, "2026-10-08"), 2);
  assert.equal(bookingError(bookings, b(3, "10:00", "13:00"), 3), null);
  assert.match(
    bookingError(bookings, b(3, "10:00", "13:00"), 2)!,
    /daily limit/,
  );
});
test("editing excludes own booking and cancellation frees capacity", () => {
  assert.equal(
    bookingError([b(1, "07:00", "08:00")], b(1, "07:00", "08:00"), 1, 1),
    null,
  );
  assert.equal(
    bookingError(
      [{ ...b(1, "07:00", "08:00"), cancelled: true }],
      b(2, "07:00", "08:00"),
      1,
    ),
    null,
  );
});
test("rejects malformed dates, invalid durations and off-grid times", () => {
  for (const candidate of [
    { ...b(1, "07:00", "08:00"), date: "2026-02-31" },
    b(1, "07:00", "07:00"),
    b(1, "07:00", "10:30"),
    b(1, "07:15", "08:00"),
    b(1, "05:00", "06:00"),
  ])
    assert.ok(bookingError([], candidate, 8));
  assert.equal(bookingError([], b(1, "23:00", "24:00"), 8), null);
  assert.equal(bookingError([], b(1, "07:00", "10:00"), 12), null);
});
test("12 distinct daily users are allowed, a thirteenth is rejected", () => {
  const bookings = Array.from({ length: 12 }, (_, i) =>
    b(i + 1, "07:00", "08:00"),
  );
  assert.equal(
    bookingError(bookings.slice(0, 11), b(12, "12:00", "15:00"), 12),
    null,
  );
  assert.match(bookingError(bookings, b(13, "12:00", "15:00"), 12)!, /full/);
  assert.equal(bookingError(bookings, b(1, "12:00", "15:00"), 12, 1), null);
  assert.equal(
    dailyOccupancy(
      [...bookings, { ...b(99, "12:00", "15:00"), userId: "u-1" }],
      "2026-10-08",
    ),
    12,
  );
  assert.equal(
    bookingError(
      bookings.map((b) => (b.id === 1 ? { ...b, cancelled: true } : b)),
      b(13, "12:00", "15:00"),
      12,
    ),
    null,
  );
  assert.equal(
    bookingError(
      bookings,
      { ...b(13, "12:00", "15:00"), date: "2026-10-09" },
      12,
    ),
    null,
  );
});
test("profile links reject executable schemes, credentials and lookalike hosts", () => {
  for (const value of [
    "javascript:alert(1)",
    "https://facebook.com.evil.test/x",
    "https://evil.test",
    "https://user:pass@facebook.com/x",
  ])
    assert.equal(safeProfileUrl(value), undefined);
  assert.equal(
    safeProfileUrl("https://www.facebook.com/demo"),
    "https://www.facebook.com/demo",
  );
});
