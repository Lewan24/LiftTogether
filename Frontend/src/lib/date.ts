import type { Language } from "../types";

export const APP_TODAY = new Date();

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date) {
  const result = new Date(date);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  result.setHours(12, 0, 0, 0);
  return result;
}

export function formatDate(
  date: Date,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(
    language === "pl" ? "pl-PL" : "en-GB",
    options,
  ).format(date);
}

export function dateFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function weekNumber(date: Date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    )
  );
}

// Booking release uses the gym's time zone, regardless of the browser's location.
export function isBookableDate(
  date: string,
  settings: { nextWeekReleaseDay: number; nextWeekReleaseTime: string },
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  const today = new Date(
    Date.UTC(
      Number(value("year")),
      Number(value("month")) - 1,
      Number(value("day")),
    ),
  );
  const offset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - offset);
  const releaseDay = (settings.nextWeekReleaseDay + 6) % 7;
  const released =
    offset > releaseDay ||
    (offset === releaseDay &&
      `${value("hour")}:${value("minute")}` >= settings.nextWeekReleaseTime);
  const end = new Date(monday);
  end.setUTCDate(monday.getUTCDate() + (released ? 13 : 6));
  return (
    date >= today.toISOString().slice(0, 10) &&
    date <= end.toISOString().slice(0, 10)
  );
}

export function gymToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
