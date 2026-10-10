import type { Language } from "../types";
import { Button } from "../components/ui";
export function LanguageToggle({
  language,
  setLanguage,
  dark = false,
}: {
  language: Language;
  setLanguage: (v: Language) => void;
  dark?: boolean;
}) {
  return (
    <div
      role="group"
      className={`language-toggle flex rounded-lg border border-[var(--line)] bg-white p-[3px] [&_.button]:min-h-8 [&_.button]:rounded-md [&_.button]:px-[9px] [&_.button]:text-xs [&_.active]:bg-[var(--green)] [&_.active]:text-white [&.dark]:border-white/20 [&.dark]:bg-white/10 [&.dark_.button]:text-white/80 [&.dark_.active]:bg-[var(--lime)] [&.dark_.active]:text-[var(--green-dark)] ${dark ? "dark" : ""}  `}
      aria-label="Wybór języka"
    >
      <Button
        aria-pressed={language === "pl"}
        variant="ghost"
        className={language === "pl" ? "active" : ""}
        onClick={() => setLanguage("pl")}
      >
        PL
      </Button>
      <Button
        aria-pressed={language === "en"}
        variant="ghost"
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
    </div>
  );
}
export function Logo({
  compact = false,
  name = "SIŁOWNIA DS 3",
}: {
  compact?: boolean;
  name?: string;
}) {
  return (
    <div translate="no" className="logo-wrap flex min-w-0 items-center gap-3">
      <div className="logo-mark flex size-9 shrink-0 -skew-x-[8deg] items-center gap-[3px] [&_span]:block [&_span]:w-2 [&_span]:rounded-[1px] [&_span]:bg-[var(--lime)] [&_span:nth-child(1)]:h-[18px] [&_span:nth-child(2)]:h-[30px] [&_span:nth-child(3)]:h-[22px]">
        <span />
        <span />
        <span />
      </div>
      {!compact && (
        <div className="logo-text truncate font-display text-[17px] font-bold tracking-wide text-white">
          {name}
        </div>
      )}
    </div>
  );
}
