import { z } from "zod";
import { createHttpClient } from "./http";

import { imageSchema } from "./contracts";
export * from "./contracts";

let csrf: string | null = null;
let csrfRequest: Promise<void> | undefined;
const httpTransport = createHttpClient("/api/", () => csrf);
const transport: typeof httpTransport = async (path, decode, options) => {
  if (import.meta.env.VITE_API_MODE === "mock") {
    const { mockRequest } = await import("./mock");
    return decode(await mockRequest(path, options));
  }
  return httpTransport(path, decode, options);
};
export function clearCsrf() {
  csrf = null;
  csrfRequest = undefined;
}
async function ensureCsrf() {
  if (csrf) return;
  csrfRequest ??= transport("auth/csrf", (v) =>
    z.object({ token: z.string().min(1) }).parse(v),
  )
    .then((r) => {
      csrf = r.token;
    })
    .finally(() => {
      csrfRequest = undefined;
    });
  await csrfRequest;
}
export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  options: Parameters<typeof transport>[2] = {},
): Promise<T> {
  if (
    import.meta.env.VITE_API_MODE !== "mock" &&
    options.method &&
    options.method !== "GET"
  )
    await ensureCsrf();
  return transport(path, (v) => schema.parse(v), options);
}
export const noContent = z.null();
export const resultId = z.object({ id: z.string().uuid() });
export async function uploadImage(file: File) {
  const body = new FormData();
  body.append("file", file);
  return api("images", imageSchema, { method: "POST", body });
}
export function apiMessage(error: unknown, language: "pl" | "en") {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, [string, string]> = {
    TRAINING_NOT_FINISHED: [
      "Trening jeszcze się nie zakończył.",
      "This training has not ended yet.",
    ],
    TRAINING_UNAVAILABLE: [
      "Trening jest anulowany lub już ukończony.",
      "This training is cancelled or already completed.",
    ],
    TRAINING_ALREADY_COMPLETED: [
      "Ukończonego treningu nie można zmienić.",
      "Completed trainings cannot be changed.",
    ],
    LAST_ADMIN: [
      "Nie można odebrać uprawnień ostatniemu administratorowi.",
      "The last administrator must keep administrator access.",
    ],
    ADMIN_VERIFICATION: [
      "Konto administratora musi być zweryfikowane.",
      "Administrator accounts must be verified.",
    ],
    BOOKING_WINDOW_CLOSED: [
      "Możesz rezerwować tylko dzisiaj i przyszłe dni w otwartym okresie zapisów.",
      "You can only book today and future days within the open booking window.",
    ],
    EMAIL_IN_USE: [
      "Ten adres e-mail jest już używany.",
      "This email address is already in use.",
    ],
    DATABASE_NOT_INITIALIZED: [
      "Baza danych nie została zainicjalizowana. Uruchom migracje API.",
      "The database is not initialized. Run the API migrations.",
    ],
    DEMO_STORAGE_INVALID: [
      "Dane demonstracyjne są uszkodzone. Zresetuj demo przyciskiem u góry.",
      "Demo data is invalid. Use Reset demo at the top of the page.",
    ],
    DEMO_STORAGE_UNAVAILABLE: [
      "Pamięć przeglądarki jest niedostępna. Włącz pamięć lokalną, aby używać demo.",
      "Browser storage is unavailable. Enable local storage to use the demo.",
    ],
    DEMO_STORAGE_FULL: [
      "Pamięć demonstracyjna jest pełna. Usuń obrazy lub zresetuj demo.",
      "Demo storage is full. Remove images or reset the demo.",
    ],
    DAILY_CAPACITY_FULL: [
      "Dzienny limit miejsc został osiągnięty.",
      "The daily booking limit is full.",
    ],
    CONFLICT_REFRESH: [
      "Dane zostały zmienione. Odśwież stronę i spróbuj ponownie.",
      "The data changed. Refresh and try again.",
    ],
    INVALID_CREDENTIALS: [
      "Nieprawidłowy e-mail lub hasło.",
      "Incorrect email or password.",
    ],
    PASSWORD_LENGTH: [
      "Hasło musi mieć 12–128 znaków.",
      "Password must be 12–128 characters.",
    ],
    RATE_LIMITED: [
      "Zbyt wiele prób. Spróbuj za minutę.",
      "Too many attempts. Try again in a minute.",
    ],
    INVALID_CSRF: [
      "Sesja zmieniła się. Odśwież stronę.",
      "The session changed. Refresh the page.",
    ],
    FORBIDDEN: [
      "Brak uprawnień do tej operacji.",
      "You do not have permission for this action.",
    ],
    UNAUTHENTICATED: ["Zaloguj się ponownie.", "Please sign in again."],
    DUPLICATE_RECORD: [
      "Taki wpis już istnieje.",
      "This record already exists.",
    ],
  };
  return (
    messages[code]?.[language === "pl" ? 0 : 1] ??
    (language === "pl"
      ? "Nie udało się wykonać operacji. Sprawdź połączenie i spróbuj ponownie."
      : "The operation failed. Check your connection and try again.")
  );
}
