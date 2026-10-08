import { useMemo, useState } from "react";
import { type GymSettings } from "../services/storage";
import {
  APP_TODAY,
  addDays,
  dateFromIso,
  formatDate,
  isCurrentWeekDate,
  startOfWeek,
  toIsoDate,
  weekNumber,
} from "../lib/date";
import type { Booking, Language } from "../types";
import { Button, Icon, PageHeader } from "../components/ui";
import { copy } from "../lib/copy";
import BookingCard from "../components/BookingCard";
export default function SchedulePage({
  language,
  bookings,
  setBookings,
  openBooking,
  settings,
  isAdmin,
}: {
  language: Language;
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  openBooking: (date: string, bookingId?: number) => void;
  settings: GymSettings;
  isAdmin: boolean;
}) {
  const t = copy[language];
  const [mode, setMode] = useState<"week" | "month">(
    settings.defaultCalendarView,
  );
  const [anchor, setAnchor] = useState(startOfWeek(APP_TODAY));
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(anchor, index),
  );
  const todayIso = toIsoDate(APP_TODAY);
  const cancel = (id: number) =>
    window.confirm(
      language === "pl" ? "Anulowac zapis?" : "Cancel this booking?",
    ) &&
    setBookings((all) =>
      all.map((booking) =>
        booking.id === id && (isAdmin || booking.mine)
          ? { ...booking, cancelled: true }
          : booking,
      ),
    );
  const remove = (id: number) =>
    window.confirm(
      language === "pl" ? "Usunac zapis?" : "Delete this booking?",
    ) &&
    setBookings((all) =>
      isAdmin ? all.filter((booking) => booking.id !== id) : all,
    );
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const calendarStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, index) =>
    addDays(calendarStart, index),
  );
  const bookingsByDate = useMemo(() => {
    const grouped = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const group = grouped.get(booking.date);
      if (group) group.push(booking);
      else grouped.set(booking.date, [booking]);
    }
    for (const group of grouped.values())
      group.sort((a, b) => a.start.localeCompare(b.start));
    return grouped;
  }, [bookings]);
  const sortedForDate = (date: string) => bookingsByDate.get(date) ?? [];
  return (
    <div className="page mx-auto max-w-[1540px] px-[4%] pt-11 pb-[70px] max-[820px]:px-[22px] max-[820px]:pt-[30px]">
      <PageHeader
        eyebrow={language === "pl" ? "ZAPLANUJ SWÓJ CZAS" : "PLAN YOUR TIME"}
        title={t.schedule}
        subtitle={
          isAdmin
            ? language === "pl"
              ? "Zarządzaj wszystkimi zapisami członków siłowni DS 3."
              : "Manage all DS 3 gym member bookings."
            : language === "pl"
              ? "Możesz przeglądać historię, ale zapisywać się tylko na bieżący tydzień."
              : "You can browse history, but only book within the current week."
        }
        action={
          <Button icon="plus" onClick={() => openBooking(todayIso)}>
            {t.book}
          </Button>
        }
      />
      <div className="calendar-toolbar mb-[18px] flex items-center justify-between gap-3 max-[600px]:flex-col max-[600px]:items-stretch">
        <div className="date-navigation flex items-center gap-3 [&_>_div]:flex [&_>_div]:min-w-[180px] [&_>_div]:flex-col [&_>_div]:items-center [&_strong]:font-display [&_strong]:text-sm [&_span]:text-xs [&_span]:text-[var(--ink-soft)] max-[600px]:justify-between">
          <Button
            variant="icon"
            onClick={() =>
              setAnchor(
                mode === "week"
                  ? addDays(anchor, -7)
                  : new Date(
                      anchor.getFullYear(),
                      anchor.getMonth() - 1,
                      1,
                      12,
                    ),
              )
            }
          >
            <Icon name="chevron-left" />
          </Button>
          <div>
            <strong>
              {mode === "week"
                ? `${formatDate(weekDays[0], language, { day: "numeric", month: "short" })} – ${formatDate(weekDays[6], language, { day: "numeric", month: "short", year: "numeric" })}`
                : formatDate(monthStart, language, {
                    month: "long",
                    year: "numeric",
                  })}
            </strong>
            <span>
              {language === "pl" ? "Tydzień" : "Week"} {weekNumber(anchor)}
            </span>
          </div>
          <Button
            variant="icon"
            onClick={() =>
              setAnchor(
                mode === "week"
                  ? addDays(anchor, 7)
                  : new Date(
                      anchor.getFullYear(),
                      anchor.getMonth() + 1,
                      1,
                      12,
                    ),
              )
            }
          >
            <Icon name="chevron-right" />
          </Button>
        </div>
        <Button
          variant="secondary"
          className="current-week-lock rounded-full bg-[var(--green-pale)] px-3 py-2 text-xs font-bold text-[var(--green)]"
          onClick={() => setAnchor(startOfWeek(APP_TODAY))}
        >
          <Icon name="shield" size={16} />
          {language === "pl"
            ? "Wróć do bieżącego tygodnia"
            : "Back to the current week"}
        </Button>
        <div className="view-switch flex rounded-lg border border-[var(--line)] bg-white p-[3px] [&_.active]:bg-[var(--green-dark)] [&_.active]:text-white max-[600px]:[&_.button]:flex-1">
          <Button
            variant="ghost"
            className={mode === "week" ? "active" : ""}
            onClick={() => setMode("week")}
          >
            {t.week}
          </Button>
          <Button
            variant="ghost"
            className={mode === "month" ? "active" : ""}
            onClick={() => setMode("month")}
          >
            {t.month}
          </Button>
        </div>
      </div>
      {mode === "week" ? (
        <div className="week-calendar grid min-h-[410px] grid-cols-[repeat(7,minmax(135px,1fr))] overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          {weekDays.map((day) => {
            const date = toIsoDate(day);
            const canManageDate = isAdmin || isCurrentWeekDate(date);
            return (
              <div
                className={`day-column min-w-[135px] border-r border-[var(--line)] last:border-r-0 [&.today]:bg-[#fbfcf8] ${date === todayIso ? "today" : ""}    ${!canManageDate ? "locked-column" : ""}  `}
                key={date}
              >
                <Button
                  variant="ghost"
                  className="day-head relative flex min-h-[78px] w-full flex-col gap-1 rounded-none border-b border-[var(--line)] [&_span]:text-xs [&_strong]:font-display [&_strong]:text-[23px] [&_strong]:text-[var(--ink)] [&_i]:absolute [&_i]:bottom-0 [&_i]:h-[3px] [&_i]:w-[34px] [&_i]:bg-[var(--green)]"
                  onClick={() => canManageDate && openBooking(date)}
                  disabled={!canManageDate}
                >
                  <span>{formatDate(day, language, { weekday: "short" })}</span>
                  <strong>{day.getDate()}</strong>
                  {date === todayIso && <i />}
                </Button>
                <div className="day-slots flex flex-col gap-2 px-[7px] py-[10px] [&_.booking-card]:flex-wrap [&_.booking-card]:items-start">
                  {sortedForDate(date).map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onEdit={
                        isAdmin || (booking.mine && canManageDate)
                          ? () => openBooking(date, booking.id)
                          : undefined
                      }
                      onDelete={isAdmin ? () => remove(booking.id) : undefined}
                    />
                  ))}
                  <Button
                    variant="ghost"
                    className="add-slot min-h-9 w-full border border-dashed border-[var(--line-dark)] text-xs text-[var(--ink-soft)] hover:border-[var(--green)] hover:text-[var(--green)]"
                    onClick={() => openBooking(date)}
                    disabled={!canManageDate}
                  >
                    <Icon name="plus" size={16} />{" "}
                    {language === "pl" ? "Dodaj zapis" : "Add booking"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="month-calendar grid grid-cols-7 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
          {monthDays.map((day) => {
            const date = toIsoDate(day);
            const isActive = isAdmin || isCurrentWeekDate(date);
            return (
              <Button
                variant="ghost"
                className={`month-day flex min-h-[112px] min-w-0 flex-col gap-1 border-r border-b border-[var(--line)] p-2.5 text-xs font-bold [&:nth-child(7n)]:border-r-0 [&.today_>_span]:rounded-full [&.today_>_span]:bg-[var(--green)] [&.today_>_span]:text-white [&_small]:truncate [&_small]:rounded [&_small]:bg-[var(--green-pale)] [&_small]:px-1 [&_small]:py-1 [&_small]:text-[10px] [&_small.mine]:bg-[var(--green)] [&_small.mine]:text-white [&.locked-day]:bg-[#f4f5f2] [&.locked-day]:opacity-60 max-[600px]:min-h-[70px] max-[600px]:p-1 max-[600px]:[&_small]:hidden ${date === todayIso ? "today" : ""}    ${day.getMonth() !== monthStart.getMonth() ? "muted-day bg-[#fafbfa] text-[#67776c]" : ""}    ${!isActive ? "locked-day" : ""}  `}
                key={date}
                onClick={() => isActive && openBooking(date)}
                disabled={!isActive}
              >
                <span>{day.getDate()}</span>
                {sortedForDate(date)
                  .slice(0, 2)
                  .map((booking) => (
                    <small
                      className={`  ${booking.color}    ${booking.mine ? "mine" : ""}  `}
                      key={booking.id}
                    >
                      {booking.start} {booking.name}
                    </small>
                  ))}
              </Button>
            );
          })}
        </div>
      )}
      <section className="my-bookings mt-9">
        <div className="section-heading mb-[18px] flex items-end justify-between gap-5 [&_.eyebrow]:mb-1">
          <div>
            <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
              {isAdmin ? "ZARZĄDZANIE" : "TWÓJ PLAN"}
            </div>
            <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
              {isAdmin
                ? language === "pl"
                  ? "Wszystkie nadchodzące zapisy"
                  : "All upcoming bookings"
                : t.yourBookings}
            </div>
          </div>
        </div>
        <div className="my-booking-list grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
          {bookings
            .filter((booking) => isAdmin || booking.mine)
            .sort((a, b) =>
              `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`),
            )
            .map((booking) => {
              const bookingDate = dateFromIso(booking.date);
              return (
                <div
                  className="my-booking-row flex gap-2 [&_.booking-card]:flex-1"
                  key={booking.id}
                >
                  <div className="date-tile flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--green-dark)] text-white [&_strong]:text-xl [&_span]:text-xs [&_span]:text-[var(--lime)]">
                    <strong>{bookingDate.getDate()}</strong>
                    <span>
                      {formatDate(bookingDate, language, {
                        month: "short",
                      }).toUpperCase()}
                    </span>
                  </div>
                  <BookingCard
                    booking={booking}
                    onEdit={
                      isAdmin || isCurrentWeekDate(booking.date)
                        ? () => openBooking(booking.date, booking.id)
                        : undefined
                    }
                    onCancel={
                      !isAdmin &&
                      isCurrentWeekDate(booking.date) &&
                      !booking.cancelled
                        ? () => cancel(booking.id)
                        : undefined
                    }
                    onDelete={isAdmin ? () => remove(booking.id) : undefined}
                  />
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
