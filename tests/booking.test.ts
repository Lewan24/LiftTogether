import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingError, peakConcurrent } from "../src/lib/booking.ts";
import { safeProfileUrl } from "../src/lib/validation.ts";
const b = (id: number, start: string, end: string) => ({
  id,
  userId: "u",
  date: "2026-10-08",
  start,
  end,
  name: "Demo",
  initials: "D",
  color: "green",
});
test("capacity uses simultaneous occupancy, adjacent bookings do not overlap", () => {
  const bookings = [b(1, "07:00", "08:00"), b(2, "08:00", "09:00")];
  assert.equal(peakConcurrent(bookings, "2026-10-08"), 1);
  assert.equal(bookingError(bookings, b(3, "07:00", "09:00"), 2), null);
  assert.match(bookingError(bookings, b(3, "07:00", "09:00"), 1)!, /full/);
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
    b(1, "07:00", "10:00"),
    b(1, "07:15", "08:00"),
    b(1, "05:00", "06:00"),
  ])
    assert.ok(bookingError([], candidate, 8));
  assert.equal(bookingError([], b(1, "23:00", "24:00"), 8), null);
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
