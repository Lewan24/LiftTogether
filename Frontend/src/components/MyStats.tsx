import { useEffect, useState } from "react";
import {
  api,
  apiMessage,
  noContent,
  profileStatsSchema,
  trainingPageSchema,
  type ProfileStats,
} from "../services/api";
import type { Booking, Language } from "../types";
import { dateFromIso, formatDate, trainingFinished } from "../lib/date";
import { Button } from "./ui";
import Pagination from "./Pagination";

export default function MyStats({ language }: { language: Language }) {
  const pl = language === "pl";
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setStats(null);
    setBookings([]);
    setError("");
    void Promise.all([
      api("profile/stats", profileStatsSchema, { signal: controller.signal }),
      api("profile/trainings", trainingPageSchema, {
        query: { page },
        signal: controller.signal,
      }),
    ])
      .then(([summary, history]) => {
        if (controller.signal.aborted) return;
        setStats(summary);
        setBookings(history.bookings);
        setHasMore(history.hasMore);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(apiMessage(failure, language));
      });
    return () => controller.abort();
  }, [page, refresh, language]);
  const complete = async (booking: Booking) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`bookings/${booking.id}/complete`, noContent, {
        method: "POST",
        body: { version: booking.version },
      });
      setRefresh((value) => value + 1);
    } catch (failure) {
      setError(apiMessage(failure, language));
    } finally {
      setBusy(false);
    }
  };
  const weekdays = pl
    ? [
        "Niedziela",
        "Poniedziałek",
        "Wtorek",
        "Środa",
        "Czwartek",
        "Piątek",
        "Sobota",
      ]
    : [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
  const best =
    stats && stats.scheduledBookings > 0
      ? Math.max(...stats.weekdays.map((day) => day.scheduled))
      : 0;
  return (
    <section aria-labelledby="my-stats-title" className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="my-stats-title"
          className="font-display text-2xl font-extrabold"
        >
          {pl ? "Moje statystyki" : "My Stats"}
        </h2>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {pl ? "Odśwież" : "Refresh"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-[var(--red)]">
          {error}{" "}
          <Button
            variant="ghost"
            onClick={() => setRefresh((value) => value + 1)}
          >
            {pl ? "Spróbuj ponownie" : "Retry"}
          </Button>
        </p>
      )}
      {!stats && !error && (
        <p role="status">
          {pl ? "Wczytywanie statystyk…" : "Loading your stats…"}
        </p>
      )}
      {stats && (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--line)] py-6 md:grid-cols-4">
            {[
              [
                pl ? "Ukończone treningi" : "Completed trainings",
                stats.completedTrainings,
              ],
              [
                pl ? "Godziny na siłowni" : "Gym hours",
                new Intl.NumberFormat(pl ? "pl-PL" : "en-GB", {
                  maximumFractionDigits: 1,
                }).format(stats.trainingMinutes / 60),
              ],
              [pl ? "Tematy na forum" : "Forum posts", stats.forumPosts],
              [
                pl ? "Odpowiedzi na forum" : "Forum comments",
                stats.forumComments,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-[var(--ink-soft)]">{label}</dt>
                <dd className="mt-2 font-display text-4xl font-extrabold text-[var(--green-dark)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            {pl
              ? "Czas obejmuje długość rezerwacji oznaczonych przez Ciebie jako ukończone. Nie jest pomiarem obecności."
              : "Hours use the booked duration of sessions you mark as completed. They are not a measurement of attendance."}
          </p>
          <div className="my-8 grid gap-8 md:grid-cols-[3fr_2fr]">
            <div>
              <h3 className="mb-2 font-display text-xl font-bold">
                {pl ? "Twój rytm tygodnia" : "Your weekly rhythm"}
              </h3>
              <p className="mb-5 text-sm text-[var(--ink-soft)]">
                {pl
                  ? "Udział każdego dnia w nieanulowanych rezerwacjach, także przyszłych. Anulowania pokazujemy osobno."
                  : "Each day's share of non-cancelled bookings, including future sessions. Cancellations are shown separately."}
              </p>
              {best === 0 && (
                <p className="mb-4">
                  {pl
                    ? "Zarezerwuj pierwszy trening, aby odkryć swój rytm."
                    : "Book your first training to discover your rhythm."}
                </p>
              )}
              {[1, 2, 3, 4, 5, 6, 0].map((index) => {
                const day = stats.weekdays.find(
                  (value) => value.weekday === index,
                )!;
                return (
                  <div key={index} className="mb-3">
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span
                        className={
                          best > 0 && day.scheduled === best
                            ? "font-bold text-[var(--green)]"
                            : ""
                        }
                      >
                        {weekdays[index]}
                        {best > 0 && day.scheduled === best
                          ? pl
                            ? " · Ulubiony"
                            : " · Favourite"
                          : ""}
                      </span>
                      <span>{day.percentage}%</span>
                    </div>
                    <div
                      role="meter"
                      aria-label={weekdays[index]}
                      aria-valuenow={day.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2 overflow-hidden rounded-full bg-[var(--line)]"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--green)]"
                        style={{ width: `${day.percentage}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[var(--ink-soft)]">
                      {pl
                        ? `Rezerwacje: ${day.scheduled}, ukończone: ${day.completed}, anulowane: ${day.cancelled}`
                        : `Booked: ${day.scheduled}, completed: ${day.completed}, cancelled: ${day.cancelled}`}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="border-l-4 border-[var(--green)] pl-5">
              <h3 className="font-display text-xl font-bold">
                {pl ? "Najpopularniejszy temat" : "Most popular post"}
              </h3>
              {stats.mostPopularPost ? (
                <>
                  <p className="mt-4 break-words font-bold">
                    {stats.mostPopularPost.title}
                  </p>
                  <p className="mt-2 text-sm">
                    {stats.mostPopularPost.replies}{" "}
                    {pl
                      ? "odpowiedzi innych osób"
                      : "replies from other members"}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm">
                  {pl
                    ? "Rozpocznij rozmowę na forum, aby zobaczyć tu swój temat."
                    : "Start a forum discussion to see your post here."}
                </p>
              )}
              <p className="mt-6 text-sm text-[var(--ink-soft)]">
                {pl
                  ? `Łącznie: ${stats.scheduledBookings} nieanulowanych rezerwacji i ${stats.cancelledBookings} anulowanych.`
                  : `${stats.scheduledBookings} non-cancelled bookings and ${stats.cancelledBookings} cancellations in total.`}
              </p>
            </div>
          </div>
          <h3 className="mb-3 font-display text-xl font-bold">
            {pl ? "Historia treningów" : "Training history"}
          </h3>
          {bookings.length === 0 && (
            <p>
              {pl
                ? "Nie masz jeszcze rezerwacji. Zaplanuj trening w harmonogramie."
                : "No bookings yet. Plan a training on the schedule."}
            </p>
          )}
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-4"
            >
              <div>
                <p className="font-bold">
                  {formatDate(dateFromIso(booking.date), language, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {booking.start}–{booking.end}
                </p>
              </div>
              {booking.cancelled ? (
                <span>{pl ? "Anulowany" : "Cancelled"}</span>
              ) : booking.completedAt ? (
                <span className="font-bold text-[var(--green)]">
                  {pl ? "Ukończony" : "Completed"}
                </span>
              ) : trainingFinished(booking.date, booking.end) ? (
                <Button disabled={busy} onClick={() => void complete(booking)}>
                  {pl ? "Oznacz jako ukończony" : "Mark as completed"}
                </Button>
              ) : (
                <span>{pl ? "Zaplanowany" : "Scheduled"}</span>
              )}
            </div>
          ))}
          <Pagination
            language={language}
            page={page}
            hasMore={hasMore}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
