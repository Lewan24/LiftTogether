import { useState, type FormEvent } from "react";
import type { AdminMemberInput, User } from "../services/storage";
import type { Language } from "../types";
import { apiMessage } from "../services/api";
import { Button, Field, Icon } from "./ui";
import Dialog from "./Dialog";

export default function AdminUserEditor({
  member,
  language,
  onSave,
  onClose,
}: {
  member?: User;
  language: Language;
  onSave: (input: AdminMemberInput, id?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AdminMemberInput>({
    role: member?.role ?? "user",
    firstName: member?.firstName ?? "",
    lastName: member?.lastName ?? "",
    email: member?.email ?? "",
    dormitory: member?.dormitory ?? "DS 3",
    room: member?.room ?? "",
    facebookUrl: member?.facebookUrl ?? "",
    phone: member?.phone ?? "",
    verified: member?.verified ?? false,
    version: member?.version ?? 0,
    password: "",
    adminNotes: member?.adminNotes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setValue = (key: keyof AdminMemberInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave(form, member?.id);
      onClose();
    } catch (failure) {
      setError(apiMessage(failure, language));
    } finally {
      setBusy(false);
    }
  }
  const label = (pl: string, en: string) => (language === "pl" ? pl : en);
  return (
    <Dialog
      close={onClose}
      label={
        member
          ? label("Edytuj użytkownika", "Edit member")
          : label("Utwórz użytkownika", "Create member")
      }
      className="max-h-[90dvh] w-[calc(100%-24px)] max-w-2xl overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-0 text-[var(--ink)] shadow-2xl"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--line)] bg-white px-5 py-5 sm:px-7">
        <div>
          <h2 id="admin-user-title" className="font-display text-2xl font-bold">
            {member
              ? label("Edytuj użytkownika", "Edit member")
              : label("Utwórz użytkownika", "Create member")}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {label(
              "Dane kontaktowe, dostęp do aplikacji i notatki zespołu.",
              "Contact details, app access and team notes.",
            )}
          </p>
        </div>
        <Button
          variant="icon"
          aria-label={label("Zamknij", "Close")}
          onClick={onClose}
          disabled={busy}
        >
          <Icon name="close" />
        </Button>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="min-w-0 px-5 py-5 sm:px-7">
          <legend className="sr-only">
            {label("Dane użytkownika", "User details")}
          </legend>
          <h3 className="mb-4 font-display text-base font-bold">
            {label("Dane użytkownika", "User details")}
          </h3>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field
              label={label("Imię", "First name")}
              value={form.firstName}
              onChange={(event) => setValue("firstName", event.target.value)}
              maxLength={100}
              required
            />
            <Field
              label={label("Nazwisko", "Last name")}
              value={form.lastName}
              onChange={(event) => setValue("lastName", event.target.value)}
              maxLength={100}
              required
            />
          </div>
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setValue("email", event.target.value)}
            maxLength={254}
            required
          />
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field
              label={label("Akademik", "Dormitory")}
              value={form.dormitory}
              onChange={(event) => setValue("dormitory", event.target.value)}
              maxLength={100}
              required
            />
            <Field
              label={label("Pokój", "Room")}
              value={form.room}
              onChange={(event) => setValue("room", event.target.value)}
              maxLength={100}
              required
            />
          </div>
          <Field
            label="Facebook (https://facebook.com/...)"
            type="url"
            value={form.facebookUrl}
            onChange={(event) => setValue("facebookUrl", event.target.value)}
            maxLength={254}
          />
          <Field
            label={label("Telefon", "Phone")}
            type="tel"
            value={form.phone ?? ""}
            onChange={(event) => setValue("phone", event.target.value)}
            maxLength={100}
          />
          <h3 className="mb-4 border-t border-[var(--line)] pt-5 font-display text-base font-bold">
            {label("Dostęp do aplikacji", "App access")}
          </h3>
          <label className="mb-4 flex flex-col gap-2 text-sm font-bold">
            {label("Rola konta", "Account role")}
            <select
              className="w-full rounded-lg border border-[var(--line-dark)] bg-white p-3 font-normal"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value as "admin" | "user",
                  verified:
                    event.target.value === "admin" ? true : current.verified,
                }))
              }
            >
              <option value="user">{label("Użytkownik", "Member")}</option>
              <option value="admin">
                {label("Administrator", "Administrator")}
              </option>
            </select>
            <span className="text-xs font-normal text-[var(--ink-soft)]">
              {label(
                "Administrator zarządza użytkownikami, treściami i ustawieniami. Zmiana roli wyloguje użytkownika.",
                "Administrators manage users, content and settings. Changing the role signs the user out.",
              )}
            </span>
          </label>
          <Field
            label={
              member
                ? label("Nowe hasło (opcjonalne)", "New password (optional)")
                : label("Hasło", "Password")
            }
            type="password"
            autoComplete="new-password"
            value={form.password ?? ""}
            onChange={(event) => setValue("password", event.target.value)}
            minLength={12}
            maxLength={128}
            required={!member}
          />
          <p className="mb-4 text-xs text-[var(--ink-soft)]">
            {label(
              "Hasło: 12–128 znaków. Zmiana hasła wyloguje użytkownika.",
              "Password: 12–128 characters. Changing it signs the member out.",
            )}
          </p>
          <label className="mb-5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.verified}
              disabled={form.role === "admin"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  verified: event.target.checked,
                }))
              }
            />
            {label("Konto zweryfikowane", "Verified account")}
          </label>
          <label className="mb-5 flex flex-col gap-2 text-sm font-bold">
            {label("Notatki administracji", "Administration notes")}
            <span className="text-xs font-normal text-[var(--ink-soft)]">
              {label(
                "Widoczne wyłącznie dla administratorów. Maksymalnie 4000 znaków.",
                "Only administrators can see these notes. Maximum 4000 characters.",
              )}
            </span>
            <textarea
              className="min-h-28 w-full resize-y rounded-lg border border-[var(--line-dark)] p-3 font-normal"
              value={form.adminNotes ?? ""}
              maxLength={4000}
              onChange={(event) => setValue("adminNotes", event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="mb-4 text-red-700">
              {error}
            </p>
          )}
        </fieldset>
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-[var(--line)] bg-white px-5 py-4 sm:px-7">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {label("Anuluj", "Cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {label("Zapisz", "Save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
