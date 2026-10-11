import { useEffect, useState } from "react";
import {
  api,
  apiMessage,
  statisticsSchema,
  type AdminStatisticsData,
} from "../services/api";
import {
  addDays,
  dateFromIso,
  formatDate,
  gymToday,
  toIsoDate,
} from "../lib/date";
import type { Language } from "../types";
import { Button, Icon } from "./ui";

export default function AdminStatistics({ language }: { language: Language }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(gymToday);
  const [statistics, setStatistics] = useState<AdminStatisticsData | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const text = (pl: string, en: string) => (language === "pl" ? pl : en);
  const weekday = (day: number) =>
    new Intl.DateTimeFormat(language === "pl" ? "pl-PL" : "en-GB", {
      weekday: "long",
    }).format(new Date(2026, 0, 4 + day, 12));
  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-GB", {
      maximumFractionDigits: digits,
    }).format(value);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    async function load() {
      try {
        const result = await api("admin/statistics", statisticsSchema, {
          query: { period, date: anchor },
          signal: controller.signal,
        });
        setStatistics(result);
        setError("");
      } catch (failure) {
        if (!controller.signal.aborted) setError(apiMessage(failure, language));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [period, anchor, refresh, language]);
  function move(direction: number) {
    const date = dateFromIso(anchor);
    if (period === "week") setAnchor(toIsoDate(addDays(date, direction * 7)));
    else
      setAnchor(
        toIsoDate(
          new Date(date.getFullYear(), date.getMonth() + direction, 1, 12),
        ),
      );
  }
  const busiest = statistics?.busiestWeekday;
  const highestDaily = Math.max(
    1,
    ...(statistics?.daily.map((day) => day.bookings) ?? []),
  );
  return (
    <section
      aria-label={text("Statystyki siłowni", "Gym statistics")}
      aria-busy={loading}
      className="mb-6 rounded-xl border border-[var(--line)] bg-white p-6 max-[600px]:p-4"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold">
            {text("Siłownia w liczbach", "Gym in numbers")}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {text(
              "Rezerwacje i aktywność całej społeczności.",
              "Bookings and activity across the community.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={period === "week" ? "primary" : "ghost"}
            aria-pressed={period === "week"}
            onClick={() => setPeriod("week")}
          >
            {text("Tydzień", "Week")}
          </Button>
          <Button
            variant={period === "month" ? "primary" : "ghost"}
            aria-pressed={period === "month"}
            onClick={() => setPeriod("month")}
          >
            {text("Miesiąc", "Month")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setRefresh((value) => value + 1)}
          >
            {text("Odśwież", "Refresh")}
          </Button>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-[var(--line)] pb-4">
        <Button
          variant="icon"
          icon="chevron-left"
          aria-label={text("Poprzedni okres", "Previous period")}
          onClick={() => move(-1)}
        />
        <p className="font-bold" aria-live="polite">
          {statistics && !loading
            ? `${formatDate(dateFromIso(statistics.from), language, { day: "numeric", month: "short" })} – ${formatDate(dateFromIso(statistics.to), language, { day: "numeric", month: "short", year: "numeric" })}`
            : text("Ładowanie statystyk…", "Loading statistics…")}
        </p>
        <Button
          variant="icon"
          icon="chevron-right"
          aria-label={text("Następny okres", "Next period")}
          onClick={() => move(1)}
        />
        <Button variant="ghost" onClick={() => setAnchor(gymToday())}>
          {text("Bieżący okres", "Current period")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-[var(--red)]">
          {error}
        </p>
      )}
      {statistics && !loading && !error && (
        <>
          <dl className="mb-6 grid grid-cols-4 gap-5 border-b border-[var(--line)] pb-6 max-[820px]:grid-cols-2">
            <div>
              <dt className="text-sm text-[var(--ink-soft)]">
                {text("Rezerwacje w okresie", "Bookings in period")}
              </dt>
              <dd className="mt-2 font-display text-3xl font-extrabold tabular-nums">
                {number(statistics.bookings)}
              </dd>
              <dd className="mt-1 text-xs text-[var(--ink-soft)]">
                {number(statistics.trainingMembers)}{" "}
                {text("osób z rezerwacją", "members with bookings")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--ink-soft)]">
                {text("Konta w aplikacji", "App accounts")}
              </dt>
              <dd className="mt-2 font-display text-3xl font-extrabold tabular-nums">
                {number(statistics.totalUsers)}
              </dd>
              <dd className="mt-1 text-xs text-[var(--ink-soft)]">
                {number(statistics.verifiedMembers)}{" "}
                {text("zweryfikowanych członków", "verified members")},{" "}
                {number(statistics.pendingMembers)}{" "}
                {text("oczekujących", "pending")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--ink-soft)]">
                {text("Tematy na forum", "Forum topics")}
              </dt>
              <dd className="mt-2 font-display text-3xl font-extrabold tabular-nums">
                {number(statistics.forumTopics)}
              </dd>
              <dd className="mt-1 text-xs text-[var(--ink-soft)]">
                {number(statistics.periodForumTopics)}{" "}
                {text("nowych w okresie", "new in period")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--ink-soft)]">
                {text("Najpopularniejszy dzień", "Busiest weekday")}
              </dt>
              <dd className="mt-2 font-display text-xl font-extrabold capitalize">
                {busiest == null ? "—" : weekday(busiest)}
              </dd>
              <dd className="mt-1 text-xs text-[var(--ink-soft)]">
                {busiest == null
                  ? text("Brak rezerwacji", "No bookings")
                  : `${number(statistics.weekdays.find((day) => day.weekday === busiest)!.average, 2)} ${text("rezerwacji średnio", "bookings on average")}`}
              </dd>
            </div>
          </dl>
          <div className="grid grid-cols-[1.5fr_1fr] gap-7 max-[820px]:grid-cols-1">
            <div>
              <h3 className="mb-2 font-display text-lg font-bold">
                {text("Rezerwacje dzień po dniu", "Daily bookings")}
              </h3>
              <p className="mb-5 text-xs text-[var(--ink-soft)]">
                {text(
                  "Aktywne rezerwacje; rezygnacje nie są uwzględnione.",
                  "Active bookings; cancellations excluded.",
                )}
              </p>
              <div
                className="flex h-44 items-end gap-1"
                role="img"
                aria-label={text(
                  "Wykres rezerwacji dziennych. Szczegóły w tabeli poniżej.",
                  "Daily bookings chart. Values in the table below.",
                )}
              >
                {statistics.daily.map((day) => (
                  <div
                    key={day.date}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                    title={`${day.date}: ${day.bookings}`}
                  >
                    <div
                      className="min-h-1 rounded-t-sm bg-[var(--green)]"
                      style={{
                        height: `${Math.max(2, (day.bookings / highestDaily) * 85)}%`,
                      }}
                    />
                    <span className="text-center text-[10px] text-[var(--ink-soft)]">
                      {Number(day.date.slice(-2))}
                    </span>
                  </div>
                ))}
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-[var(--green)]">
                  {text("Dane dzienne", "Daily data")}
                </summary>
                <table className="mt-2 w-full text-left">
                  <caption className="sr-only">
                    {text("Liczba rezerwacji według daty", "Bookings by date")}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{text("Data", "Date")}</th>
                      <th scope="col">{text("Rezerwacje", "Bookings")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statistics.daily.map((day) => (
                      <tr key={day.date}>
                        <th scope="row" className="py-1 font-normal">
                          {formatDate(dateFromIso(day.date), language, {
                            day: "numeric",
                            month: "short",
                            weekday: "short",
                          })}
                        </th>
                        <td>{day.bookings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
            <div>
              <h3 className="mb-2 font-display text-lg font-bold">
                {text("Średnia według dnia tygodnia", "Average by weekday")}
              </h3>
              <p className="mb-4 text-xs text-[var(--ink-soft)]">
                {text(
                  "Rezerwacje na dzień, także dni bez zapisów.",
                  "Bookings per day, including days with none.",
                )}
              </p>
              <dl className="space-y-3">
                {statistics.weekdays.map((day) => (
                  <div key={day.weekday}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <dt className="capitalize">{weekday(day.weekday)}</dt>
                      <dd className="tabular-nums">{number(day.average, 2)}</dd>
                    </div>
                    <div
                      aria-hidden="true"
                      className="h-1.5 rounded-full bg-[var(--green-pale)]"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--green)]"
                        style={{
                          width: `${Math.min(100, (day.average / Math.max(1, ...statistics.weekdays.map((item) => item.average))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--line)] pt-4 text-sm text-[var(--ink-soft)]">
            <span className="inline-flex items-center gap-2">
              <Icon name="activity" size={16} />
              {text("Średnio dziennie:", "Daily average:")}{" "}
              {number(statistics.averageDailyBookings, 2)}
            </span>
            <span>
              {text("Rezygnacje:", "Cancellations:")}{" "}
              {number(statistics.cancelledBookings)}
            </span>
            <span>
              {text("Nowe aktualności:", "New news posts:")}{" "}
              {number(statistics.periodNewsPosts)}
            </span>
          </p>
        </>
      )}
    </section>
  );
}
