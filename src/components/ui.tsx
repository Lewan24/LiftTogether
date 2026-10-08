import {
  Children,
  isValidElement,
  useId,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
} from "react";
import { twMerge } from "tailwind-merge";
export type IconName =
  | "home"
  | "calendar"
  | "users"
  | "bell"
  | "settings"
  | "logout"
  | "chevron-left"
  | "chevron-right"
  | "plus"
  | "clock"
  | "edit"
  | "trash"
  | "check"
  | "shield"
  | "image"
  | "message"
  | "menu"
  | "close"
  | "arrow"
  | "activity"
  | "user-check"
  | "search";
const iconPaths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.08A1.7 1.7 0 0 0 8.55 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.08A1.7 1.7 0 0 0 4.6 8.55a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.08A1.7 1.7 0 0 0 15.45 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.38.33.72.6 1 .3.28.68.42 1.1.4h.08v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  message: (
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  "user-check": (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="m17 11 2 2 4-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon shrink-0"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}
const variants = {
  primary:
    "button-primary bg-[var(--green)] text-white shadow-sm hover:bg-[#11572b]",
  secondary:
    "button-secondary border border-[var(--line)] bg-white text-[var(--ink)] shadow-sm hover:border-[var(--line-dark)] hover:bg-[#fbfcfa]",
  ghost:
    "button-ghost bg-transparent px-2.5 text-[var(--ink-soft)] hover:bg-[var(--green-pale)]",
  icon: "button-icon size-11 min-h-11 rounded-full p-0 text-[var(--ink-soft)] hover:bg-[var(--green-pale)] hover:text-[var(--green)]",
  danger: "button-danger bg-[#f8e8e6] text-[var(--red)] hover:bg-[#f1d5d1]",
};
const iconLabels: Partial<Record<IconName, string>> = {
  close: "Close dialog",
  menu: "Open menu",
  edit: "Edit booking",
  trash: "Delete",
  bell: "Notifications",
  "chevron-left": "Previous period",
  "chevron-right": "Next period",
};
export function Button({
  children,
  variant = "primary",
  icon,
  className,
  ...props
}: {
  children?: ReactNode;
  variant?: keyof typeof variants;
  icon?: IconName;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const childIcon = Children.toArray(children).find(
    (child) =>
      isValidElement<{
        name?: IconName;
      }>(child) && child.props.name,
  );
  const name = isValidElement<{
    name?: IconName;
  }>(childIcon)
    ? childIcon.props.name
    : icon;
  return (
    <button
      type="button"
      aria-label={
        variant === "icon" && name ? (iconLabels[name] ?? name) : undefined
      }
      className={twMerge(
        "button inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-[18px] text-sm font-bold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green)] disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={18} />} {children}
    </button>
  );
}
export function Field({
  label,
  error,
  helper,
  id: suppliedId,
  className,
  ...props
}: {
  label: string;
  error?: string;
  helper?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const description = error || helper;
  return (
    <div className="mb-[18px] flex flex-col gap-2 text-sm font-bold text-[var(--ink)]">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        maxLength={props.type === "password" ? 128 : 254}
        autoComplete="off"
        spellCheck={props.type !== "email"}
        aria-invalid={error ? true : undefined}
        aria-describedby={description ? id + "-description" : undefined}
        className={twMerge(
          "w-full rounded-[10px] border border-[var(--line-dark)] bg-white px-[15px] py-[13px] font-medium text-[var(--ink)] placeholder:text-[var(--ink-soft)] transition-colors focus-visible:border-[var(--green)]",
          className,
        )}
        {...props}
      />
      {description && (
        <p
          id={id + "-description"}
          role={error ? "alert" : undefined}
          className={
            error
              ? "text-sm font-medium text-[var(--red)]"
              : "text-sm font-medium text-[var(--ink-soft)]"
          }
        >
          {description}
        </p>
      )}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-5 max-[600px]:flex-col max-[600px]:items-stretch">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold text-[var(--green)]">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-tight text-balance max-[600px]:text-[28px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-[var(--ink-soft)]">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
