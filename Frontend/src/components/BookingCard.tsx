import type { Booking } from "../types";
import { Button, Icon } from "../components/ui";
export default function BookingCard({
  booking,
  onEdit,
  onCancel,
  onDelete,
}: {
  booking: Booking;
  onEdit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`booking-card flex min-w-0 items-center gap-2 rounded-lg border border-[var(--line)] bg-white p-2.5 [&.mine]:border-[#8fbd98] [&.mine]:bg-[#f0f8f1] [&.cancelled]:opacity-50 [&.cancelled]:line-through ${booking.mine ? "mine" : ""}    ${booking.cancelled ? "cancelled" : ""}  `}
    >
      <div
        className={`mini-avatar grid size-[31px] shrink-0 place-items-center rounded-full text-xs font-bold text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)] ${booking.color}  `}
      >
        {booking.initials}
      </div>
      <div className="booking-info flex min-w-0 flex-1 flex-col [&_strong]:truncate [&_strong]:text-xs [&_span]:mt-1 [&_span]:flex [&_span]:items-center [&_span]:gap-1 [&_span]:text-xs [&_span]:text-[var(--ink-soft)]">
        <strong>{booking.name}</strong>
        <span>
          <Icon name="clock" size={14} /> {booking.start}–{booking.end}
        </span>
      </div>
      {booking.mine && (
        <span className="you-tag rounded bg-[var(--green-pale)] px-1 py-1 text-xs font-bold text-[var(--green)]">
          TY
        </span>
      )}
      {onEdit && (
        <Button
          variant="icon"
          aria-label={"Edit booking for " + booking.name}
          onClick={onEdit}
        >
          <Icon name="edit" size={16} />
        </Button>
      )}
      {onCancel && (
        <Button
          variant="ghost"
          className="cancel-link ml-auto text-xs text-[var(--red)]"
          onClick={onCancel}
        >
          Zrezygnuj
        </Button>
      )}
      {onDelete && (
        <Button
          variant="icon"
          className="admin-delete text-[var(--red)]"
          aria-label={"Delete booking for " + booking.name}
          onClick={onDelete}
        >
          <Icon name="trash" size={16} />
        </Button>
      )}
    </div>
  );
}
