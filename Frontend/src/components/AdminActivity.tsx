import { useEffect, useState } from "react";
import {
  api,
  apiMessage,
  auditPageSchema,
  type AuditEntry,
} from "../services/api";
import type { Language } from "../types";
import { Button } from "./ui";
import Pagination from "./Pagination";

const actions: Record<string, [string, string]> = {
  "auth.register": ["utworzył konto", "registered an account"],
  "auth.login": ["zalogował się", "signed in"],
  "auth.login.failed": ["nieudane logowanie", "failed sign-in"],
  "auth.logout": ["wylogował się", "signed out"],
  "profile.update": ["zmienił profil", "updated their profile"],
  "password.change": ["zmienił hasło", "changed their password"],
  "member.create": ["utworzył użytkownika", "created a member"],
  "member.update": ["zmienił użytkownika", "updated a member"],
  "member.verify": [
    "zmienił weryfikację użytkownika",
    "changed member verification",
  ],
  "booking.save": ["zapisał rezerwację", "saved a booking"],
  "booking.cancel": ["odwołał rezerwację", "cancelled a booking"],
  "booking.delete": ["usunął rezerwację", "deleted a booking"],
  "post.create": ["utworzył aktualność", "created news"],
  "post.edit": ["zmienił aktualność", "edited news"],
  "post.delete": ["usunął aktualność", "deleted news"],
  "post.comment.create": ["skomentował aktualność", "commented on news"],
  "post.comment.delete": ["usunął komentarz", "deleted a news comment"],
  "forum.create": ["utworzył temat", "created a forum topic"],
  "forum.edit": ["zmienił temat", "edited a forum topic"],
  "forum.delete": ["usunął temat", "deleted a forum topic"],
  "forum.pin": ["zmienił przypięcie tematu", "changed a topic pin"],
  "forum.reply.create": ["odpowiedział na forum", "replied on the forum"],
  "forum.reply.delete": ["usunął odpowiedź", "deleted a forum reply"],
  "category.save": ["zapisał kategorię", "saved a category"],
  "category.delete": ["usunął kategorię", "deleted a category"],
  "settings.update": ["zmienił ustawienia", "updated settings"],
  "bootstrap.admin": ["utworzono administratora", "administrator seeded"],
  "bootstrap.regulations": ["utworzono regulamin", "gym regulations seeded"],
};

export default function AdminActivity({
  language,
  compact = false,
}: {
  language: Language;
  compact?: boolean;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await api("audit", auditPageSchema, {
          query: { page },
          signal: controller.signal,
        });
        setEntries(result.entries);
        setHasMore(result.hasMore);
        setError("");
      } catch (failure) {
        if (!controller.signal.aborted) setError(apiMessage(failure, language));
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
  }, [page, refresh, language]);
  return (
    <div>
      {!compact && (
        <Button
          variant="secondary"
          onClick={() => setRefresh((value) => value + 1)}
        >
          {language === "pl" ? "Odśwież" : "Refresh"}
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
      {!error && entries.length === 0 && (
        <p className="py-4 text-[var(--ink-soft)]">
          {language === "pl" ? "Brak aktywności." : "No activity yet."}
        </p>
      )}
      {(compact ? entries.slice(0, 4) : entries).map((entry) => (
        <div
          key={entry.id}
          className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] py-3 text-sm"
        >
          <div>
            <p>
              <strong>{entry.actorName}</strong>{" "}
              {actions[entry.action]?.[language === "pl" ? 0 : 1] ??
                entry.action}
            </p>
            {!compact && (
              <p className="mt-1 break-all text-xs text-[var(--ink-soft)]">
                {entry.target}
              </p>
            )}
          </div>
          <time
            dateTime={entry.createdAt}
            className="text-xs text-[var(--ink-soft)]"
          >
            {new Intl.DateTimeFormat(language === "pl" ? "pl-PL" : "en-GB", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "Europe/Warsaw",
            }).format(new Date(entry.createdAt))}
          </time>
        </div>
      ))}
      {!compact && (
        <Pagination
          language={language}
          page={page}
          hasMore={hasMore}
          onChange={setPage}
        />
      )}
    </div>
  );
}
