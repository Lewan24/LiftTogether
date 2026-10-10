import { useState, type FormEvent } from "react";
import { api, apiMessage, clearCsrf, noContent } from "../services/api";
import { Button, Field } from "./ui";
import type { Language } from "../types";
export default function PasswordChange({ language }: { language: Language }) {
  const [currentPassword, setCurrent] = useState(""),
    [newPassword, setNew] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
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
      className="mt-6 rounded-xl border border-[var(--line)] bg-white p-6"
    >
      <h2 className="mb-5 text-xl font-bold">
        {pl ? "Zmień hasło" : "Change password"}
      </h2>
      <Field
        label={pl ? "Obecne hasło" : "Current password"}
        type="password"
        required
        value={currentPassword}
        autoComplete="current-password"
        onChange={(e) => setCurrent(e.target.value)}
      />
      <Field
        label={
          pl ? "Nowe hasło (12–128 znaków)" : "New password (12–128 characters)"
        }
        type="password"
        minLength={12}
        maxLength={128}
        required
        value={newPassword}
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
      <Button type="submit" disabled={busy}>
        {pl ? "Zmień hasło" : "Change password"}
      </Button>
    </form>
  );
}
