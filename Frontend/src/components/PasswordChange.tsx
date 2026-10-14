import { useState, type FormEvent } from "react";
import { api, apiMessage, clearCsrf, noContent } from "../services/api";
import { Button, Field, Icon } from "./ui";
import type { Language } from "../types";
export default function PasswordChange({ language }: { language: Language }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pl = language === "pl";
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("auth/password", noContent, {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      clearCsrf();
      setCurrent("");
      setNew("");
      setMessage(
        pl
          ? "Hasło zmienione. Pozostałe sesje zostały wylogowane."
          : "Password changed. Other sessions have been signed out.",
      );
    } catch (e) {
      setError(apiMessage(e, language));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      aria-labelledby="password-change-title"
      className="rounded-xl border border-[var(--line)] bg-white p-7 max-[600px]:p-5"
    >
      <div className="mb-6 border-b border-[var(--line)] pb-5">
        <div className="mb-4 grid size-10 place-items-center rounded-lg bg-[var(--green-pale)] text-[var(--green)]">
          <Icon name="shield" size={21} />
        </div>
        <h2
          id="password-change-title"
          className="font-display text-xl font-extrabold"
        >
          {pl ? "Bezpieczeństwo konta" : "Account security"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
          {pl
            ? "Ustaw unikalne hasło. Po zmianie pozostałe sesje zostaną wylogowane."
            : "Use a unique password. Changing it signs out your other sessions."}
        </p>
      </div>
      <Field
        label={pl ? "Obecne hasło" : "Current password"}
        type="password"
        required
        value={currentPassword}
        name="currentPassword"
        autoComplete="current-password"
        onChange={(e) => setCurrent(e.target.value)}
      />
      <Field
        label={pl ? "Nowe hasło" : "New password"}
        type="password"
        helper={pl ? "Od 12 do 128 znaków." : "Between 12 and 128 characters."}
        minLength={12}
        maxLength={128}
        required
        value={newPassword}
        name="newPassword"
        autoComplete="new-password"
        onChange={(e) => setNew(e.target.value)}
      />
      {error && (
        <p role="alert" className="mb-3 text-[var(--red)]">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-3 text-[var(--green)]">
          {message}
        </p>
      )}
      <Button
        type="submit"
        variant="secondary"
        className="mt-2 w-full"
        disabled={busy}
      >
        {pl ? "Zmień hasło" : "Change password"}
      </Button>
    </form>
  );
}
