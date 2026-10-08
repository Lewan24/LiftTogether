import { FormEvent, useState, useEffect, useRef } from "react";
import {
  authenticate,
  createUser,
  demoAccounts,
  type User,
} from "../services/storage";
import type { Language } from "../types";
import { Button, Field, Icon } from "../components/ui";
import { copy } from "../lib/copy";
import { Logo, LanguageToggle } from "../components/Brand";
export default function LoginScreen({
  language,
  setLanguage,
  onLogin,
  onRegister,
  gymName,
  registrationEnabled,
}: {
  language: Language;
  setLanguage: (v: Language) => void;
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
  gymName: string;
  registrationEnabled: boolean;
}) {
  const t = copy[language];
  const resolvedGymName = gymName?.trim() || "Siłownia DS 3";
  const [role, setRole] = useState<"user" | "admin">("user");
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    dormitory: "",
    room: "",
    facebookUrl: "",
  });
  const setValue = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const chooseDemo = (type: "user" | "admin") => {
    setRegister(false);
    setRole(type);
    setError("");
    setForm((current) => ({ ...current, ...demoAccounts[type] }));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (register) {
      try {
        const user = createUser({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          dormitory: form.dormitory.trim(),
          room: form.room.trim(),
          facebookUrl: form.facebookUrl.trim(),
        });
        onRegister(user);
      } catch {
        setError(
          language === "pl"
            ? "Konto z tym adresem e-mail już istnieje."
            : "Check your details, unique email, and password (at least 8 characters).",
        );
      }
      return;
    }
    const user = authenticate(form.email, form.password);
    if (!user || user.role !== role) {
      setError(
        language === "pl"
          ? "Nieprawidłowy e-mail, hasło lub wybrany typ konta."
          : "Incorrect email, password or selected account type.",
      );
      return;
    }
    onLogin(user);
  };
  return (
    <main className="login-page grid min-h-dvh grid-cols-[1.05fr_.95fr] bg-white max-[820px]:grid-cols-1">
      <section className="login-brand relative flex min-h-dvh flex-col overflow-hidden bg-[var(--green-dark)] px-[7%] py-11 text-white max-[820px]:hidden">
        <div className="brand-top relative z-10 flex items-center justify-between">
          <Logo name={resolvedGymName} />
          <LanguageToggle language={language} setLanguage={setLanguage} dark />
        </div>
        <div className="brand-copy relative z-10 my-auto max-w-[580px] [&_p]:mt-7 [&_p]:max-w-[490px] [&_p]:text-base [&_p]:leading-relaxed [&_p]:text-white/75">
          <div className="eyebrow light mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
            {t.brandKicker}
          </div>
          <div className="display-title font-display text-[clamp(50px,5vw,79px)] leading-[1.1] font-bold tracking-[-3px] [&_em]:not-italic [&_em]:text-[var(--lime)]">
            {t.brandTitle}
            <br />
            <em>{t.brandAccent}</em>
          </div>
          <p>{t.brandDescription}</p>
        </div>
        <div className="brand-stat relative z-10 flex gap-16 border-t border-white/20 pt-7 [&_div]:flex [&_div]:flex-col [&_strong]:font-display [&_strong]:text-[28px] [&_strong]:text-[var(--lime)] [&_span]:mt-1 [&_span]:text-xs [&_span]:text-white/70">
          <div>
            <strong>124</strong>
            <span>{t.members}</span>
          </div>
          <div>
            <strong>6–24</strong>
            <span>{t.openingHours}</span>
          </div>
        </div>
        <div className="brand-grid pointer-events-none absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,.3)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.3)_1px,transparent_1px)] bg-size-[80px_80px]" />
      </section>
      <section className="login-panel flex items-center justify-center p-[60px] max-[820px]:min-h-dvh max-[820px]:flex-col max-[820px]:justify-start max-[820px]:px-[22px] max-[820px]:py-7">
        <div className="mobile-login-head hidden w-full items-center justify-between gap-4 max-[820px]:mb-8 max-[820px]:flex [&_.logo-text]:text-[var(--green-dark)]">
          <Logo name={resolvedGymName} />
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </div>
        <form
          className="login-form w-full max-w-[440px] max-[820px]:my-auto"
          onSubmit={submit}
        >
          <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
            {resolvedGymName.toUpperCase()}
          </div>
          <h1 className="form-title mb-2 font-display text-[34px] font-extrabold tracking-tight">
            {register
              ? language === "pl"
                ? "Załóż konto"
                : "Create your account"
              : t.welcome}
          </h1>
          <p className="muted text-[var(--ink-soft)] leading-relaxed">
            {register
              ? language === "pl"
                ? "Dołącz do społeczności swojego akademika."
                : "Join your campus gym community."
              : t.loginText}
          </p>
          {!register && (
            <div className="role-switch mt-8 mb-6 grid grid-cols-2 rounded-[10px] bg-[var(--paper)] p-1 [&_.active]:bg-white [&_.active]:text-[var(--ink)] [&_.active]:shadow-sm">
              <Button
                type="button"
                variant="ghost"
                aria-pressed={role === "user"}
                className={role === "user" ? "active" : ""}
                onClick={() => {
                  setRole("user");
                  setError("");
                }}
              >
                {t.user}
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-pressed={role === "admin"}
                className={role === "admin" ? "active" : ""}
                onClick={() => {
                  setRole("admin");
                  setError("");
                }}
              >
                {t.administrator}
              </Button>
            </div>
          )}
          {register && (
            <div className="form-row grid grid-cols-2 gap-3 max-[600px]:grid-cols-1 max-[600px]:gap-0">
              <Field
                label={language === "pl" ? "Imię" : "First name"}
                placeholder="Aleksandra"
                value={form.firstName}
                onChange={(e) => setValue("firstName", e.target.value)}
                required
                name="firstName"
                autoComplete="given-name"
              />
              <Field
                label={language === "pl" ? "Nazwisko" : "Last name"}
                placeholder="Nowak"
                value={form.lastName}
                onChange={(e) => setValue("lastName", e.target.value)}
                required
                name="lastName"
                autoComplete="family-name"
              />
            </div>
          )}
          <Field
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={error ? true : undefined}
            label={t.email}
            type="email"
            placeholder="aleksandra@campus.edu"
            value={form.email}
            onChange={(e) => setValue("email", e.target.value)}
            required
            name="email"
            autoComplete="email"
          />
          <Field
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={error ? true : undefined}
            label={t.password}
            type="password"
            minLength={register ? 8 : undefined}
            autoComplete={register ? "new-password" : "current-password"}
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setValue("password", e.target.value)}
            required
            name="password"
          />
          {register && (
            <>
              <div className="form-row grid grid-cols-2 gap-3 max-[600px]:grid-cols-1 max-[600px]:gap-0">
                <Field
                  label={language === "pl" ? "Akademik" : "Dormitory"}
                  placeholder="DS 3"
                  value={form.dormitory}
                  onChange={(e) => setValue("dormitory", e.target.value)}
                  required
                  name="dormitory"
                  autoComplete="off"
                />
                <Field
                  label={language === "pl" ? "Pokój" : "Room"}
                  placeholder="214"
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
                    ? "Facebook URL (opcjonalnie)"
                    : "Facebook URL (optional)"
                }
                type="url"
                placeholder="https://facebook.com/..."
                value={form.facebookUrl}
                onChange={(e) => setValue("facebookUrl", e.target.value)}
                name="facebookUrl"
                autoComplete="url"
              />
            </>
          )}
          {!register && (
            <div className="form-options my-6 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--ink-soft)]">
                {language === "pl"
                  ? "Sesja demo trwa do odswiezenia strony."
                  : "Demo session ends when the page reloads."}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="text-[color:var(--green)] p-[0] min-h-[auto]"
                onClick={() =>
                  setError(
                    language === "pl"
                      ? "Reset has\u0142a b\u0119dzie dost\u0119pny po pod\u0142\u0105czeniu API."
                      : "Password recovery requires an API connection.",
                  )
                }
              >
                {t.forgot}
              </Button>
            </div>
          )}
          {error && (
            <div
              id="login-error"
              ref={errorRef}
              tabIndex={-1}
              className="login-error mb-4 rounded-lg bg-[#f8e8e6] px-3 py-3 text-sm font-medium text-[var(--red)]"
              role="alert"
            >
              {error}
            </div>
          )}
          {!register && (
            <div className="demo-accounts mb-4 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_>_div]:grid [&_>_div]:grid-cols-2 [&_>_div]:gap-2 [&_.button]:px-2 [&_.button]:text-xs [&_small]:text-xs [&_small]:text-[var(--green)] max-[600px]:[&_>_div]:grid-cols-1">
              <span>
                {language === "pl"
                  ? "Szybkie logowanie do wersji demo"
                  : "Quick access to the demo"}
              </span>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => chooseDemo("user")}
                >
                  <Icon name="users" size={16} />
                  {language === "pl" ? "Konto użytkownika" : "Member account"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => chooseDemo("admin")}
                >
                  <Icon name="shield" size={16} />
                  {language === "pl" ? "Konto administratora" : "Admin account"}
                </Button>
              </div>
              <small>
                {role === "admin"
                  ? `${demoAccounts.admin.email} · ${demoAccounts.admin.password}`
                  : `${demoAccounts.user.email} · ${demoAccounts.user.password}`}
              </small>
            </div>
          )}
          <Button
            type="submit"
            className="login-submit min-h-[50px] w-full justify-between px-[22px]"
          >
            {register ? t.register : t.login}
            <Icon name="arrow" size={18} />
          </Button>
          {(register || registrationEnabled) && (
            <div className="register-row mt-6 flex flex-wrap items-center justify-center gap-1 text-sm text-[var(--ink-soft)]">
              <span>
                {register
                  ? language === "pl"
                    ? "Masz już konto?"
                    : "Already have an account?"
                  : t.noAccount}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="text-[color:var(--green)] p-[0] min-h-[auto]"
                onClick={() => {
                  setRegister(!register);
                  setRole("user");
                  setError("");
                }}
              >
                {register ? t.login : t.register}
              </Button>
            </div>
          )}
          <div className="secure-note mt-9 flex items-center justify-center gap-2 text-xs text-[var(--ink-soft)]">
            <Icon name="shield" size={16} />{" "}
            {language === "pl"
              ? "Twoje dane są bezpieczne i szyfrowane"
              : "Your data is secure and encrypted"}
          </div>
        </form>
      </section>
    </main>
  );
}
