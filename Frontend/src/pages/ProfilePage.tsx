import { FormEvent, useEffect, useState } from "react";
import MyStats from "../components/MyStats";
import PasswordChange from "../components/PasswordChange";
import { type User } from "../services/storage";
import type { Language } from "../types";
import { Button, Field, Icon } from "../components/ui";
export default function ProfilePage({
  language,
  user,
  onSave,
}: {
  language: Language;
  user: User;
  onSave: (user: User) => Promise<void>;
}) {
  const [section, setSection] = useState<"profile" | "stats">("profile");
  const [form, setForm] = useState(user);
  useEffect(() => setForm(user), [user]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const setValue = (key: keyof User, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSave(form);
      setSaved(true);
      setError("");
    } catch {
      setError(
        language === "pl"
          ? "Sprawd\u017a dane i adres Facebook. E-mail musi by\u0107 unikalny."
          : "Check your details and Facebook URL. Email must be unique.",
      );
    } finally {
      setBusy(false);
    }
  };
  const initials =
    `${form.firstName[0] ?? ""}${form.lastName[0] ?? ""}`.toUpperCase();
  return (
    <div className="page mx-auto max-w-[1180px] px-[4%] pt-11 pb-[70px] max-[820px]:px-[22px] max-[820px]:pt-[30px]">
      <header className="mb-6 overflow-hidden rounded-2xl bg-[var(--green-dark)] text-white">
        <div className="flex flex-wrap items-center justify-between gap-6 px-8 py-8 max-[600px]:px-5">
          <div className="flex min-w-0 items-center gap-5 max-[600px]:items-start">
            <div
              aria-hidden="true"
              className="grid size-[72px] shrink-0 place-items-center rounded-2xl bg-[var(--lime)] font-display text-2xl font-extrabold text-[var(--green-dark)]"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-sm text-white/70">
                {language === "pl"
                  ? "Twoje konto Lift Together"
                  : "Your Lift Together account"}
              </p>
              <h1 className="break-words font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                {user.firstName} {user.lastName}
              </h1>
              <p className="mt-2 break-all text-sm text-white/75">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex max-w-full items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-[var(--lime)]">
            <Icon
              name={
                user.verified || user.role === "admin" ? "user-check" : "clock"
              }
              size={18}
            />
            {user.role === "admin"
              ? "Administrator"
              : user.verified
                ? language === "pl"
                  ? "Konto zweryfikowane"
                  : "Verified member"
                : language === "pl"
                  ? "Oczekuje na weryfikację"
                  : "Awaiting verification"}
          </div>
        </div>
        {user.role !== "admin" && (
          <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-white/15 px-8 py-4 text-sm max-[600px]:px-5">
            <div className="flex min-w-0 max-w-full items-baseline gap-3">
              <dt className="text-white/65">
                {language === "pl" ? "Akademik" : "Dormitory"}
              </dt>
              <dd className="min-w-0 break-words font-semibold">
                {user.dormitory}
              </dd>
            </div>
            <div className="flex min-w-0 max-w-full items-baseline gap-3">
              <dt className="text-white/65">
                {language === "pl" ? "Pokój" : "Room"}
              </dt>
              <dd className="min-w-0 break-words font-semibold">{user.room}</dd>
            </div>
          </dl>
        )}
      </header>
      <nav
        aria-label={language === "pl" ? "Sekcje konta" : "Account sections"}
        className="mb-7 flex gap-6 border-b border-[var(--line)]"
      >
        <Button
          variant="ghost"
          className={`rounded-none border-b-2 px-1 pb-4 hover:bg-transparent ${section === "profile" ? "border-[var(--green)] text-[var(--green-dark)]" : "border-transparent"}`}
          aria-pressed={section === "profile"}
          onClick={() => setSection("profile")}
        >
          {language === "pl" ? "Mój profil" : "My profile"}
        </Button>
        {(user.verified || user.role === "admin") && (
          <Button
            variant="ghost"
            className={`rounded-none border-b-2 px-1 pb-4 hover:bg-transparent ${section === "stats" ? "border-[var(--green)] text-[var(--green-dark)]" : "border-transparent"}`}
            aria-pressed={section === "stats"}
            onClick={() => setSection("stats")}
          >
            {language === "pl" ? "Moje statystyki" : "My Stats"}
          </Button>
        )}
      </nav>
      {section === "stats" && (user.verified || user.role === "admin") ? (
        <MyStats language={language} />
      ) : (
        <>
          {!user.verified && user.role !== "admin" && (
            <section
              role="status"
              aria-labelledby="verification-notice-title"
              className="mb-6 rounded-xl border border-[var(--green)]/25 bg-[var(--lime)]/15 p-6 text-[var(--green-dark)]"
            >
              <h2
                id="verification-notice-title"
                className="mb-3 flex items-center gap-2 font-display text-xl font-bold"
              >
                <Icon name="clock" size={22} />
                {language === "pl"
                  ? "Konto utworzone — oczekuje na weryfikację"
                  : "Account created — awaiting verification"}
              </h2>
              <p className="mb-2">
                {language === "pl"
                  ? "Administrator musi zatwierdzić Twoje konto przed uzyskaniem dostępu do rezerwacji, aktualności i forum. Sprawdzi dane profilu oraz członkostwo w grupie siłowni."
                  : "An administrator must approve your account before you can access bookings, news and the forum. They will review your profile details and gym group membership."}
              </p>
              <p>
                {language === "pl"
                  ? "Sprawdź poniżej imię, nazwisko, akademik, numer pokoju i adres profilu Facebook. Jeśli potrzebujesz pomocy z weryfikacją, skontaktuj się z administracją siłowni. Po zatwierdzeniu wróć do aplikacji lub odśwież stronę."
                  : "Check your name, dormitory, room number and Facebook profile below. Contact the gym administration if you need help with verification. Once approved, return to the app or refresh the page."}
              </p>
            </section>
          )}
          <div className="profile-layout grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] items-start gap-6 max-[900px]:grid-cols-1">
            <form
              aria-labelledby="profile-details-title"
              className="min-w-0 rounded-xl border border-[var(--line)] bg-white p-7 max-[600px]:p-5"
              onSubmit={submit}
            >
              <div className="mb-6 border-b border-[var(--line)] pb-5">
                <h2
                  id="profile-details-title"
                  className="font-display text-xl font-extrabold"
                >
                  {language === "pl" ? "Dane osobowe" : "Personal details"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                  {language === "pl"
                    ? "Dbaj o aktualność danych kontaktowych i informacji do weryfikacji konta."
                    : "Keep your contact details and account verification information up to date."}
                </p>
              </div>
              <div className="form-row grid grid-cols-2 gap-3 max-[600px]:grid-cols-1 max-[600px]:gap-0">
                <Field
                  label={language === "pl" ? "Imię" : "First name"}
                  value={form.firstName}
                  onChange={(e) => setValue("firstName", e.target.value)}
                  required
                  maxLength={100}
                  name="firstName"
                  autoComplete="given-name"
                />
                <Field
                  label={language === "pl" ? "Nazwisko" : "Last name"}
                  value={form.lastName}
                  onChange={(e) => setValue("lastName", e.target.value)}
                  required
                  maxLength={100}
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
                <Button disabled={busy} type="submit" icon="check">
                  {language === "pl" ? "Zapisz zmiany" : "Save changes"}
                </Button>
              </div>
            </form>
            <aside className="w-full min-w-0 max-w-[440px] max-[600px]:max-w-none">
              <PasswordChange language={language} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
