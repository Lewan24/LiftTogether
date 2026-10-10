import { useEffect, useRef } from "react";
import type { User } from "../services/storage";
import type { Language, AppView } from "../types";
import { Button, Icon, type IconName } from "./ui";
import { copy } from "../lib/copy";
import { Logo, LanguageToggle } from "./Brand";
import useMediaQuery from "../hooks/useMediaQuery";
export function Sidebar({
  view,
  setView,
  language,
  admin,
  verified,
  gymName,
  logout,
  open,
  setOpen,
}: {
  view: AppView;
  setView: (v: AppView) => void;
  language: Language;
  admin: boolean;
  verified: boolean;
  gymName: string;
  logout: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const t = copy[language],
    mobile = useMediaQuery("(max-width: 820px)"),
    ref = useRef<HTMLElement>(null);
  const closeRef = useRef(setOpen);
  closeRef.current = setOpen;
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        ref.current!.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled]),summary",
        ),
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current(false);
      }
      if (event.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, mobile]);
  const nav: { id: AppView; label: string; icon: IconName }[] = [
    ...(verified
      ? [
          { id: "home" as const, label: t.home, icon: "home" as const },
          { id: "news" as const, label: t.news, icon: "message" as const },
          { id: "forum" as const, label: "Forum", icon: "message" as const },
          {
            id: "schedule" as const,
            label: t.schedule,
            icon: "calendar" as const,
          },
        ]
      : []),
    { id: "profile", label: t.profile, icon: "users" },
    ...(admin
      ? [{ id: "admin" as const, label: t.admin, icon: "shield" as const }]
      : []),
  ];
  return (
    <aside
      ref={ref}
      id="app-navigation"
      aria-label={language === "pl" ? "Nawigacja" : "Main navigation"}
      aria-hidden={mobile && !open ? true : undefined}
      inert={mobile && !open}
      className={
        "fixed inset-y-0 left-0 z-30 flex w-[246px] flex-col bg-[var(--green-dark)] px-[22px] pt-[31px] pb-[22px] text-white transition-transform duration-200 max-[820px]:shadow-xl " +
        (mobile && !open ? "-translate-x-full" : "translate-x-0")
      }
    >
      <div className="mb-8 flex items-center justify-between gap-2">
        <Logo name={gymName} />
        <Button
          variant="icon"
          className="hidden text-white max-[820px]:inline-flex"
          aria-label={language === "pl" ? "Zamknij menu" : "Close menu"}
          onClick={() => setOpen(false)}
        >
          <Icon name="close" />
        </Button>
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map((item) => (
          <a
            key={item.id}
            href={"#" + item.id}
            aria-current={view === item.id ? "page" : undefined}
            className={
              "flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-colors hover:bg-white/10 hover:text-white " +
              (view === item.id
                ? "bg-white/10 text-[var(--lime)]"
                : "text-white/80")
            }
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              setView(item.id);
              setOpen(false);
            }}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="mt-auto pt-6">
        <details className="mb-4 rounded-xl border border-white/15 bg-white/10 p-4 text-sm">
          <summary className="cursor-pointer font-bold">
            {language === "pl" ? "Potrzebujesz pomocy?" : "Need help?"}
          </summary>
          <p className="mt-3 leading-relaxed text-white/80">
            {language === "pl"
              ? "Skontaktuj si\u0119 z administracj\u0105 si\u0142owni na miejscu."
              : "Contact gym staff at the reception desk."}
          </p>
        </details>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 border-t border-white/15 rounded-none pt-3 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={logout}
        >
          <Icon name="logout" />
          {t.logout}
        </Button>
      </div>
    </aside>
  );
}
export function Topbar({
  language,
  setLanguage,
  user,
  setOpen,
  openProfile,
}: {
  language: Language;
  setLanguage: (v: Language) => void;
  user: User;
  setOpen: (v: boolean) => void;
  openProfile: () => void;
}) {
  const t = copy[language];
  const initials = (
    user.firstName.charAt(0) + user.lastName.charAt(0)
  ).toUpperCase();
  return (
    <header className="sticky top-0 z-10 flex h-[76px] items-center gap-4 border-b border-[var(--line)] bg-white/95 px-[4%] backdrop-blur-sm max-[600px]:h-[68px] max-[600px]:gap-2 max-[600px]:px-4">
      <Button
        variant="icon"
        className="hidden max-[820px]:inline-flex"
        aria-label={language === "pl" ? "Otworz menu" : "Open menu"}
        aria-controls="app-navigation"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" />
      </Button>
      <div className="flex-1" />
      <LanguageToggle language={language} setLanguage={setLanguage} />
      <Button
        variant="ghost"
        className="min-w-0 gap-2 text-[var(--ink)]"
        onClick={openProfile}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--yellow)] text-xs font-bold text-[var(--green-dark)]">
          {initials}
        </span>
        <span className="flex min-w-0 flex-col items-start max-[600px]:hidden">
          <strong className="max-w-[180px] truncate text-xs">
            {user.firstName} {user.lastName}
          </strong>
          <span className="text-xs text-[var(--ink-soft)]">
            {user.role === "admin"
              ? t.administrator
              : user.dormitory + " / " + user.room}
          </span>
        </span>
        <Icon name="chevron-right" size={16} />
      </Button>
    </header>
  );
}
