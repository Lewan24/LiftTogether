import { z } from "zod";
import { createHttpClient } from "./http";

const id = z.string().uuid();
export const userSchema = z.object({
  id,
  role: z.enum(["user", "admin"]),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  dormitory: z.string(),
  room: z.string(),
  facebookUrl: z.string(),
  phone: z.string(),
  verified: z.boolean(),
  version: z.number().int(),
});
export const settingsSchema = z.object({
  gymName: z.string(),
  dormitoryName: z.string(),
  maxDaily: z.number().int().positive(),
  registrationEnabled: z.boolean(),
  defaultCalendarView: z.enum(["week", "month"]),
  version: z.number().int(),
});
export const bookingSchema = z.object({
  id: z.number().int(),
  userId: id,
  date: z.string(),
  start: z.string(),
  end: z.string(),
  name: z.string(),
  initials: z.string(),
  color: z.string(),
  cancelled: z.boolean(),
  version: z.number().int(),
});
const commentSchema = z.object({
  id: z.number().int(),
  userId: id,
  author: z.string(),
  initials: z.string(),
  content: z.string(),
  createdAt: z.string(),
});
export const postSchema = z.object({
  id: z.number().int(),
  titlePl: z.string(),
  titleEn: z.string(),
  contentPl: z.string(),
  contentEn: z.string(),
  createdAt: z.string(),
  author: z.string(),
  important: z.boolean(),
  status: z.enum(["published", "draft"]),
  comments: z.array(commentSchema),
  commentCount: z.number().int(),
  version: z.number().int(),
});
export const imageSchema = z.object({
  id,
  name: z.string(),
  src: z.string().regex(/^\/api\/images\/[0-9a-f-]{36}$/i),
});
const replySchema = z.object({
  id,
  userId: id,
  author: z.string(),
  content: z.string(),
  images: z.array(imageSchema).max(4),
  createdAt: z.string(),
});
export const categorySchema = z.object({
  id,
  name: z.string(),
  version: z.number().int(),
  discussionCount: z.number().int().optional(),
});
export const discussionSchema = replySchema.extend({
  title: z.string(),
  categoryId: id,
  pinned: z.boolean(),
  comments: z.array(replySchema),
  commentCount: z.number().int(),
  version: z.number().int(),
});
export const forumSchema = z.object({
  categories: z.array(categorySchema),
  discussions: z.array(discussionSchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});
export const postPageSchema = z.object({
  posts: z.array(postSchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});
export const usersPageSchema = z.object({
  users: z.array(userSchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});
export const postDetailSchema = z.object({
  post: postSchema,
  page: z.number().int(),
  hasMore: z.boolean(),
});
export const discussionDetailSchema = z.object({
  discussion: discussionSchema,
  page: z.number().int(),
  hasMore: z.boolean(),
});
let csrf: string | null = null;
let csrfRequest: Promise<void> | undefined;
const transport = createHttpClient("/api/", () => csrf);
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
  if (options.method && options.method !== "GET") await ensureCsrf();
  return transport(path, (v) => schema.parse(v), options);
}
export const noContent = z.null();
export const resultId = z.object({ id });
export async function uploadImage(file: File) {
  const body = new FormData();
  body.append("file", file);
  return api("images", imageSchema, { method: "POST", body });
}
export function apiMessage(error: unknown, language: "pl" | "en") {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, [string, string]> = {
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
