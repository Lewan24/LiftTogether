import { useState } from "react";
import { dateFromIso, formatDate, minutes } from "../lib/date";
import type { Booking, Language } from "../types";
import { Button, Icon } from "../components/ui";
import { bookingError } from "../lib/booking";
import Dialog from "../components/Dialog";
import BookingCard from "../components/BookingCard";
export default function BookingModal({
  date,
  bookingId,
  bookings,
  close,
  save,
  language,
  isAdmin,
  maxConcurrent,
}: {
  date: string;
  bookingId?: number;
  bookings: Booking[];
  close: () => void;
  save: (start: string, end: string, bookingId?: number) => void;
  language: Language;
  isAdmin: boolean;
  maxConcurrent: number;
}) {
  const edited = bookingId
    ? bookings.find((booking) => booking.id === bookingId)
    : undefined;
  const existingMine = bookings.find(
    (booking) => booking.date === date && booking.mine,
  );
  const target = edited ?? (!isAdmin ? existingMine : undefined);
  const [startHour, setStartHour] = useState(
    target?.start.split(":")[0] || "18",
  );
  const [startMinute, setStartMinute] = useState(
    target?.start.split(":")[1] || "00",
  );
  const [endHour, setEndHour] = useState(target?.end.split(":")[0] || "19");
  const [endMinute, setEndMinute] = useState(target?.end.split(":")[1] || "30");
  const [timeError, setTimeError] = useState("");
  const selectedStart = `${startHour}:${startMinute}`;
  const selectedEnd = `${endHour}:${endHour === "24" ? "00" : endMinute}`;
  const dateValue = dateFromIso(date);
  const dayBookings = bookings
    .filter((booking) => booking.date === date && booking.id !== target?.id)
    .sort((a, b) => a.start.localeCompare(b.start));
  const overlapping = dayBookings.filter(
    (booking) =>
      !booking.cancelled &&
      minutes(booking.start) < minutes(selectedEnd) &&
      minutes(booking.end) > minutes(selectedStart),
  );
  const submitBooking = () => {
    const start = minutes(selectedStart);
    const end = minutes(selectedEnd);
    if (end - start < 30 || end - start > 120 || start < 360) {
      setTimeError(
        language === "pl"
          ? "Wybierz zakres od 30 minut do maksymalnie 2 godzin."
          : "Choose a time range from 30 minutes up to 2 hours.",
      );
      return;
    }
    const error = bookingError(
      bookings,
      { date, start: selectedStart, end: selectedEnd },
      maxConcurrent,
      target?.id,
    );
    if (error) {
      setTimeError(error);
      return;
    }
    save(selectedStart, selectedEnd, target?.id);
  };
  return (
    <div
      className="modal-backdrop fixed inset-0 z-40 grid place-items-center p-5"
      onMouseDown={close}
    >
      <Dialog
        className="modal m-auto max-h-[90dvh] w-[min(100%-32px,520px)] overflow-y-auto overscroll-contain rounded-2xl border-0 bg-white p-7 text-[var(--ink)] shadow-2xl max-[600px]:px-[18px] max-[600px]:py-[22px]"
        label={language === "pl" ? "Zapis na trening" : "Book workout"}
        close={close}
      >
        <div className="modal-head mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
              {target
                ? language === "pl"
                  ? "EDYCJA ZAPISU"
                  : "EDIT BOOKING"
                : language === "pl"
                  ? "NOWY ZAPIS"
                  : "NEW BOOKING"}
            </div>
            <div className="modal-title font-display text-[23px] font-extrabold">
              {formatDate(dateValue, language, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
            {target && isAdmin && (
              <span className="admin-editing-label mt-1 block text-sm text-[var(--ink-soft)]">
                {language === "pl" ? "Edytujesz zapis:" : "Editing:"}{" "}
                <strong>{target.name}</strong>
              </span>
            )}
          </div>
          <Button variant="icon" onClick={close}>
            <Icon name="close" />
          </Button>
        </div>
        <div className="time-fields-grid grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
          <div className="modal-section mb-[18px]">
            <span className="field-title mb-2 block text-sm font-bold">
              {language === "pl" ? "Godzina rozpoczęcia" : "Start time"}
            </span>
            <div className="time-selects flex items-center gap-2 [&_select]:min-w-0 [&_select]:flex-1 [&_select]:rounded-lg [&_select]:border [&_select]:border-[var(--line-dark)] [&_select]:bg-white [&_select]:p-3 [&_select]:text-[var(--ink)] [&_select]:font-bold">
              <select
                aria-label="Start hour"
                name="start-hour"
                value={startHour}
                onChange={(event) => setStartHour(event.target.value)}
              >
                {Array.from({ length: 24 }, (_, index) => (
                  <option key={index}>{String(index).padStart(2, "0")}</option>
                ))}
              </select>
              <b>:</b>
              <select
                aria-label="Start minute"
                name="start-minute"
                value={startMinute}
                onChange={(event) => setStartMinute(event.target.value)}
              >
                <option>00</option>
                <option>30</option>
              </select>
            </div>
          </div>
          <div className="modal-section mb-[18px]">
            <span className="field-title mb-2 block text-sm font-bold">
              {language === "pl" ? "Godzina zakończenia" : "End time"}
            </span>
            <div className="time-selects flex items-center gap-2 [&_select]:min-w-0 [&_select]:flex-1 [&_select]:rounded-lg [&_select]:border [&_select]:border-[var(--line-dark)] [&_select]:bg-white [&_select]:p-3 [&_select]:text-[var(--ink)] [&_select]:font-bold">
              <select
                aria-label="End hour"
                name="end-hour"
                value={endHour}
                onChange={(event) => setEndHour(event.target.value)}
              >
                {Array.from({ length: 25 }, (_, index) => (
                  <option key={index}>{String(index).padStart(2, "0")}</option>
                ))}
              </select>
              <b>:</b>
              <select
                aria-label="End minute"
                name="end-minute"
                value={endHour === "24" ? "00" : endMinute}
                disabled={endHour === "24"}
                onChange={(event) => setEndMinute(event.target.value)}
              >
                <option>00</option>
                <option>30</option>
              </select>
            </div>
          </div>
        </div>
        <div className="rule-note flex items-start gap-2 rounded-lg bg-[var(--green-pale)] p-3 text-sm leading-relaxed text-[var(--green-dark)]">
          <Icon name="clock" size={18} />
          <span>
            {language === "pl"
              ? "Jedna sesja dziennie, maksymalnie 2 godziny. Dostępne przedziały co 30 minut."
              : "One session per day, maximum 2 hours. Available in 30-minute intervals."}
          </span>
        </div>
        {overlapping.length > 0 && (
          <div className="overlap-note mt-3 flex items-start gap-2 rounded-lg border border-[#e1be62] bg-[#fff9e8] p-3 text-sm text-[#715711] [&_div]:flex [&_div]:flex-col [&_div]:gap-1">
            <Icon name="users" size={18} />
            <div>
              <strong>
                {language === "pl"
                  ? `${overlapping.length} ${overlapping.length === 1 ? "osoba będzie" : "osoby będą"} wtedy na siłowni`
                  : `${overlapping.length} ${overlapping.length === 1 ? "person" : "people"} will be at the gym then`}
              </strong>
              <span>
                {overlapping
                  .map(
                    (booking) =>
                      `${booking.name} (${booking.start}–${booking.end})`,
                  )
                  .join(", ")}
              </span>
            </div>
          </div>
        )}
        {timeError && (
          <div
            className="form-error mt-2 rounded-lg bg-[#f8e8e6] px-3 py-3 text-sm font-medium text-[var(--red)]"
            role="alert"
          >
            {timeError}
          </div>
        )}
        <div className="day-people my-[22px] [&_>_strong]:mb-3 [&_>_strong]:block [&_.booking-card]:mb-2">
          <strong>
            {language === "pl"
              ? "Plan dnia — chronologicznie"
              : "Day plan — chronological"}
          </strong>
          {dayBookings.map((booking) => (
            <BookingCard booking={booking} key={booking.id} />
          ))}
          {dayBookings.length === 0 && (
            <p className="empty-text text-sm text-[var(--ink-soft)]">
              {language === "pl"
                ? "Brak innych zapisów na ten dzień."
                : "No other bookings for this day."}
            </p>
          )}
        </div>
        <div className="modal-actions flex justify-end gap-2 border-t border-[var(--line)] pt-5 max-[600px]:flex-col-reverse max-[600px]:[&_.button]:w-full">
          <Button variant="secondary" onClick={close}>
            {language === "pl" ? "Anuluj" : "Cancel"}
          </Button>
          <Button onClick={submitBooking}>
            <Icon name="check" size={18} />
            {target
              ? language === "pl"
                ? "Zapisz zmiany"
                : "Save changes"
              : language === "pl"
                ? "Potwierdź zapis"
                : "Confirm booking"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
