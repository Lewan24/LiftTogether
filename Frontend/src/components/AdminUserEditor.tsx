import { useState, type FormEvent } from "react";
import type { AdminMemberInput, User } from "../services/storage";
import type { Language } from "../types";
import { apiMessage } from "../services/api";
import { Button, Field } from "./ui";
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
    <div className="modal-backdrop fixed inset-0 z-40 grid place-items-center overflow-y-auto p-5">
      <Dialog
        close={onClose}
        label={member ? "Edit member" : "Create member"}
        className="w-full max-w-xl rounded-xl bg-white p-6"
      >
        <h2
          id="admin-user-title"
          className="mb-5 font-display text-xl font-bold"
        >
          {member
            ? label("Edytuj użytkownika", "Edit member")
            : label("Utwórz użytkownika", "Create member")}
        </h2>
        <form onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
              disabled={member?.role === "admin"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  verified: event.target.checked,
                }))
              }
            />
            {label("Konto zweryfikowane", "Verified account")}
          </label>
          {error && (
            <p role="alert" className="mb-4 text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {label("Anuluj", "Cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {label("Zapisz", "Save")}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
