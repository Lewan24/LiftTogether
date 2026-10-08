import { FormEvent, useState } from "react";
import { type User } from "../services/storage";
import type { Language } from "../types";
import { Button, Field, Icon, PageHeader } from "../components/ui";
export default function ProfilePage({
  language,
  user,
  onSave,
}: {
  language: Language;
  user: User;
  onSave: (user: User) => void;
}) {
  const [form, setForm] = useState(user);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const setValue = (key: keyof User, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      onSave(form);
      setSaved(true);
      setError("");
    } catch {
      setError(
        language === "pl"
          ? "Sprawd\u017a dane i adres Facebook. E-mail musi by\u0107 unikalny."
          : "Check your details and Facebook URL. Email must be unique.",
      );
    }
  };
  const initials =
    `${form.firstName[0] ?? ""}${form.lastName[0] ?? ""}`.toUpperCase();
  return (
    <div className="page mx-auto max-w-[1540px] px-[4%] pt-11 pb-[70px] max-[820px]:px-[22px] max-[820px]:pt-[30px]">
      <PageHeader
        eyebrow={language === "pl" ? "TWOJE KONTO" : "YOUR ACCOUNT"}
        title={language === "pl" ? "Profil użytkownika" : "Member profile"}
        subtitle={
          language === "pl"
            ? "Dbaj o aktualność danych używanych do weryfikacji konta."
            : "Keep the details used to verify your account up to date."
        }
      />
      <div className="profile-layout grid grid-cols-[280px_minmax(0,680px)] items-start gap-5 max-[820px]:grid-cols-1">
        <aside className="profile-summary flex flex-col items-center rounded-xl bg-[var(--green-dark)] px-6 py-[30px] text-center text-white [&_>_span]:mt-1 [&_>_span]:text-sm [&_>_span]:text-white/70 max-[820px]:items-start max-[820px]:text-left">
          <div className="profile-avatar grid size-[86px] place-items-center rounded-full bg-[var(--lime)] font-display text-[26px] font-extrabold text-[var(--green-dark)]">
            {initials}
          </div>
          <div className="profile-name mt-4 font-display text-xl font-extrabold">
            {form.firstName} {form.lastName}
          </div>
          <span>{form.email}</span>
          <div
            className={`verification-badge mt-[18px] flex items-center gap-2 rounded-full bg-[var(--lime)]/15 px-3 py-2 text-xs font-bold text-[var(--lime)] [&.pending]:bg-[var(--yellow)]/15 [&.pending]:text-[var(--yellow)] ${form.verified ? "" : "pending"}  `}
          >
            <Icon name={form.verified ? "user-check" : "clock"} size={16} />
            {form.verified
              ? language === "pl"
                ? "Konto zweryfikowane"
                : "Verified account"
              : language === "pl"
                ? "Oczekuje na weryfikację"
                : "Awaiting verification"}
          </div>
          <div className="profile-facts mt-7 grid w-full grid-cols-2 gap-3 border-t border-white/20 pt-5 text-left [&_div]:flex [&_div]:flex-col [&_span]:text-xs [&_span]:text-white/70 [&_strong]:mt-1 [&_strong]:text-xs">
            <div>
              <span>{language === "pl" ? "Rola" : "Role"}</span>
              <strong>
                {form.role === "admin"
                  ? language === "pl"
                    ? "Administrator"
                    : "Administrator"
                  : language === "pl"
                    ? "Użytkownik"
                    : "Member"}
              </strong>
            </div>
            <div>
              <span>{language === "pl" ? "Członek od" : "Member since"}</span>
              <strong>
                {language === "pl" ? "Października 2026" : "October 2026"}
              </strong>
            </div>
          </div>
        </aside>
        <form
          className="profile-form admin-card max-[600px]:px-[18px] max-[600px]:py-[22px] rounded-xl border border-[var(--line)] bg-white p-6"
          onSubmit={submit}
        >
          <div className="section-heading mb-[18px] flex items-end justify-between gap-5 [&_.eyebrow]:mb-1">
            <div>
              <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
                {language === "pl" ? "DANE OSOBOWE" : "PERSONAL DETAILS"}
              </div>
              <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
                {language === "pl" ? "Informacje o Tobie" : "Your information"}
              </div>
            </div>
          </div>
          <div className="form-row grid grid-cols-2 gap-3 max-[600px]:grid-cols-1 max-[600px]:gap-0">
            <Field
              label={language === "pl" ? "Imię" : "First name"}
              value={form.firstName}
              onChange={(e) => setValue("firstName", e.target.value)}
              required
              name="firstName"
              autoComplete="given-name"
            />
            <Field
              label={language === "pl" ? "Nazwisko" : "Last name"}
              value={form.lastName}
              onChange={(e) => setValue("lastName", e.target.value)}
              required
              name="lastName"
              autoComplete="family-name"
            />
          </div>
          <Field
            label={language === "pl" ? "Adres e-mail" : "Email address"}
            type="email"
            value={form.email}
            onChange={(e) => setValue("email", e.target.value)}
            required
            name="email"
            autoComplete="email"
          />
          <Field
            label={language === "pl" ? "Numer telefonu" : "Phone number"}
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            value={form.phone ?? ""}
            onChange={(e) => setValue("phone", e.target.value)}
            placeholder="+48 500 000 000"
          />
          {form.role !== "admin" && (
            <>
              <div className="form-row grid grid-cols-2 gap-3 max-[600px]:grid-cols-1 max-[600px]:gap-0">
                <Field
                  label={language === "pl" ? "Akademik" : "Dormitory"}
                  value={form.dormitory}
                  onChange={(e) => setValue("dormitory", e.target.value)}
                  required
                  name="dormitory"
                  autoComplete="off"
                />
                <Field
                  label={language === "pl" ? "Numer pokoju" : "Room number"}
                  value={form.room}
                  onChange={(e) => setValue("room", e.target.value)}
                  required
                  name="room"
                  autoComplete="off"
                />
              </div>
              <Field
                label={
                  language === "pl"
                    ? "Adres profilu na Facebooku"
                    : "Facebook profile URL"
                }
                type="url"
                value={form.facebookUrl}
                onChange={(e) => setValue("facebookUrl", e.target.value)}
                placeholder="https://facebook.com/..."
                required
                name="facebookUrl"
                autoComplete="url"
              />
              <div className="rule-note profile-note flex items-start gap-2 rounded-lg bg-[var(--green-pale)] p-3 text-sm leading-relaxed text-[var(--green-dark)] mt-1">
                <Icon name="shield" size={18} />
                <span>
                  {language === "pl"
                    ? "Profil Facebook służy wyłącznie administratorowi do potwierdzenia członkostwa w grupie siłowni."
                    : "Your Facebook profile is only used by an administrator to confirm gym group membership."}
                </span>
              </div>
            </>
          )}
          {error && (
            <p
              role="alert"
              className="form-error mt-2 rounded-lg bg-[#f8e8e6] px-3 py-3 text-sm font-medium text-[var(--red)]"
            >
              {error}
            </p>
          )}
          <div className="profile-actions mt-6 flex items-center justify-end gap-4 border-t border-[var(--line)] pt-5 max-[600px]:flex-col max-[600px]:items-stretch">
            {saved && (
              <span
                role="status"
                className="save-success flex items-center gap-2 text-sm font-bold text-[var(--green)]"
              >
                <Icon name="check" size={16} />
                {language === "pl" ? "Zmiany zapisane" : "Changes saved"}
              </span>
            )}
            <Button type="submit" icon="check">
              {language === "pl" ? "Zapisz zmiany" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
