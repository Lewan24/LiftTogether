import { z } from "zod";
import {
  userSchema,
  settingsSchema,
  bookingSchema,
  postSchema,
  categorySchema,
  discussionSchema,
  auditEntrySchema,
} from "../contracts.ts";
import { ApiError } from "../http.ts";
import { addDays, startOfWeek, toIsoDate } from "../../lib/date.ts";
import type { createHttpClient } from "../http.ts";

export const DEMO_STORAGE_KEY = "lift-together-demo-v1";
export const DEMO_PASSWORD = "Demo-password-2026!";
export const stateSchema = z.object({
  version: z.literal(1),
  users: z.array(userSchema),
  settings: settingsSchema,
  bookings: z.array(bookingSchema),
  posts: z.array(postSchema),
  categories: z.array(categorySchema),
  discussions: z.array(discussionSchema),
  audit: z.array(auditEntrySchema).default([]),
  passwords: z.record(z.string(), z.string()),
  currentUserId: z.string().nullable(),
});
export type State = z.infer<typeof stateSchema>;
export type User = State["users"][number];
export type Image = State["discussions"][number]["images"][number];
export type Options = Parameters<ReturnType<typeof createHttpClient>>[2];
export const now = () => new Date().toISOString();
export const name = (u: User) => `${u.firstName} ${u.lastName}`;
export const initials = (u: User) =>
  `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
export function requireValue(
  condition: unknown,
  code = "INVALID_INPUT",
  status = 400,
): asserts condition {
  if (!condition) throw new ApiError(status, code);
}
export function text(value: unknown, max: number, required = true) {
  requireValue(
    typeof value === "string" &&
      value.trim().length <= max &&
      (!required || value.trim().length > 0),
  );
  return value.trim();
}
export function version(
  body: Record<string, unknown>,
  record: { version: number },
) {
  requireValue(body.version === record.version, "CONFLICT_REFRESH", 409);
}
function seed(): State {
  const admin: User = {
    id: crypto.randomUUID(),
    role: "admin",
    firstName: "Demo",
    lastName: "Administrator",
    email: "admin@demo.example",
    dormitory: "DS 3",
    room: "Office",
    facebookUrl: "",
    phone: "",
    verified: true,
    version: 1,
  };
  const member: User = {
    ...admin,
    id: crypto.randomUUID(),
    role: "user",
    firstName: "Aleksandra",
    lastName: "Nowak",
    email: "member@demo.example",
    room: "214",
  };
  const category = {
    id: crypto.randomUUID(),
    name: "Ogólne / General",
    version: 1,
  };
  return {
    version: 1,
    users: [admin, member],
    passwords: {},
    audit: [],
    currentUserId: null,
    settings: {
      gymName: "Lift Together · Demo",
      dormitoryName: "DS 3",
      maxDaily: 12,
      registrationEnabled: true,
      defaultCalendarView: "week",
      nextWeekReleaseDay: 0,
      nextWeekReleaseTime: "18:00",
      version: 1,
    },
    bookings: [
      {
        id: 1,
        userId: member.id,
        date: toIsoDate(addDays(startOfWeek(new Date()), 2)),
        start: "17:00",
        end: "18:30",
        name: name(member),
        initials: initials(member),
        color: "green",
        cancelled: false,
        completedAt: null,
        version: 1,
      },
    ],
    posts: [
      {
        id: 1,
        titlePl: "Witaj w siłowni",
        titleEn: "Welcome to the gym",
        contentPl:
          "Zarezerwuj trening i poznaj społeczność. To dane demonstracyjne zapisane tylko w tej przeglądarce.",
        contentEn:
          "Book a workout and meet the community. This demo stores its data only in this browser.",
        createdAt: now(),
        author: name(admin),
        important: true,
        status: "published",
        comments: [],
        commentCount: 0,
        version: 1,
      },
    ],
    categories: [
      category,
      { id: crypto.randomUUID(), name: "Trening / Training", version: 1 },
    ],
    discussions: [
      {
        id: crypto.randomUUID(),
        userId: admin.id,
        author: name(admin),
        title: "Regulamin siłowni / Gym regulations",
        content:
          "<h2>Regulamin siłowni / Gym regulations</h2><ol><li>Trenuj po weryfikacji i rezerwacji. / Train after verification and booking.</li><li>Odwołuj niewykorzystane rezerwacje. / Cancel bookings you cannot attend.</li><li>Szanuj innych i trenuj bezpiecznie. / Respect others and train safely.</li><li>Odkładaj ciężary i czyść sprzęt. / Return weights and clean equipment.</li><li>Zgłaszaj uszkodzenia administracji. / Report damaged equipment.</li></ol>",
        categoryId: category.id,
        pinned: true,
        createdAt: now(),
        images: [],
        comments: [],
        commentCount: 0,
        version: 1,
      },
      {
        id: crypto.randomUUID(),
        userId: member.id,
        author: name(member),
        title: "Wspólny trening / Training together",
        content: "<p>Who would like to train together this week?</p>",
        categoryId: category.id,
        pinned: true,
        createdAt: now(),
        images: [],
        comments: [],
        commentCount: 0,
        version: 1,
      },
    ],
  };
}
export function read() {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DEMO_STORAGE_KEY);
  } catch {
    throw new ApiError(0, "DEMO_STORAGE_UNAVAILABLE");
  }
  if (!raw) return seed();
  try {
    return stateSchema.parse(JSON.parse(raw));
  } catch {
    throw new ApiError(0, "DEMO_STORAGE_INVALID");
  }
}
export function write(state: State) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw new ApiError(0, "DEMO_STORAGE_FULL");
  }
}
export function passwordInput(value: unknown) {
  requireValue(
    typeof value === "string" && value.length > 0 && value.length <= 128,
    "PASSWORD_LENGTH",
  );
  return value;
}
export async function passwordHash(password: string, userId: string) {
  // Demo credentials are not real authentication; never persist plaintext input.
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(userId),
      iterations: 100_000,
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function sanitize(html: unknown) {
  const { default: DOMPurify } = await import("dompurify");
  return DOMPurify.sanitize(text(html, 50_000, false), {
    ALLOWED_TAGS: [
      "p",
      "br",
      "h2",
      "h3",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
    ],
    ALLOWED_ATTR: [],
  });
}
export function profile(body: Record<string, unknown>) {
  const email = text(body.email, 254).toLowerCase();
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const facebookUrl = text(body.facebookUrl ?? "", 254, false);
  if (facebookUrl) {
    const url = new URL(facebookUrl);
    requireValue(
      url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        ["facebook.com", "www.facebook.com"].includes(url.hostname),
    );
  }
  return {
    firstName: text(body.firstName, 100),
    lastName: text(body.lastName, 100),
    email,
    dormitory: text(body.dormitory, 100),
    room: text(body.room, 100),
    facebookUrl,
    phone: text(body.phone ?? "", 100, false),
  };
}
export function paginate<T>(items: T[], page: number) {
  return {
    items: items.slice(page * 50, (page + 1) * 50),
    page,
    hasMore: items.length > (page + 1) * 50,
  };
}
export const nextId = (items: { id: number }[]) =>
  Math.max(0, ...items.map((x) => x.id)) + 1;
export function find<T extends { id: string | number }>(
  items: T[],
  id: string,
) {
  const item = items.find((x) => String(x.id) === id);
  requireValue(item, "NOT_FOUND", 404);
  return item;
}
export function remove<T>(items: T[], item: T) {
  items.splice(items.indexOf(item), 1);
}
export function images(body: Record<string, unknown>): Image[] {
  requireValue(
    Array.isArray(body.images) && body.images.length <= 4,
    "INVALID_IMAGES",
  );
  return body.images.map((image) => {
    requireValue(
      typeof image === "object" &&
        image !== null &&
        typeof image.src === "string" &&
        /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image.src),
      "INVALID_IMAGES",
    );
    return { id: text(image.id, 36), name: "image.jpg", src: image.src };
  });
}
export async function upload(body: unknown): Promise<Image> {
  requireValue(body instanceof FormData, "INVALID_IMAGE");
  const file = body.get("file");
  requireValue(
    file instanceof File && file.size > 0 && file.size <= 2_097_152,
    "IMAGE_TOO_LARGE",
  );
  requireValue(
    ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    "INVALID_IMAGE",
  );
  const bitmap = await createImageBitmap(file);
  try {
    requireValue(
      bitmap.width <= 6000 &&
        bitmap.height <= 6000 &&
        bitmap.width * bitmap.height <= 16_000_000,
      "IMAGE_DIMENSIONS",
    );
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    requireValue(context, "INVALID_IMAGE");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return {
      id: crypto.randomUUID(),
      name: "image.jpg",
      src: canvas.toDataURL("image/jpeg", 0.8),
    };
  } finally {
    bitmap.close();
  }
}

export const UNHANDLED = Symbol("unhandled demo route");
export type RequestContext = {
  state: State;
  path: string;
  options: Options;
  method: string;
  body: Record<string, unknown>;
  query: Record<string, string | number>;
  page: number;
  parts: string[];
  user: User | undefined;
};
export type MemberContext = Omit<RequestContext, "user"> & { user: User };
