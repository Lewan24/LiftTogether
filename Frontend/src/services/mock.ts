import { handleDashboard } from "./mock/dashboard.ts";
import { handleSettings } from "./mock/settings.ts";
import { ApiError } from "./http.ts";
import {
  read,
  write,
  requireValue,
  passwordHash,
  DEMO_PASSWORD,
  DEMO_STORAGE_KEY,
  upload,
  UNHANDLED,
  type Options,
  type RequestContext,
} from "./mock/state.ts";
export { DEMO_PASSWORD, DEMO_STORAGE_KEY } from "./mock/state.ts";
import { handleAuth } from "./mock/auth.ts";
import { handleUsers } from "./mock/users.ts";
import { handleBookings } from "./mock/bookings.ts";
import { handlePosts } from "./mock/posts.ts";
import { handleCategories } from "./mock/categories.ts";
import { handleForum } from "./mock/forum.ts";

async function route(
  state: RequestContext["state"],
  path: string,
  options: Options = {},
): Promise<unknown> {
  const page = Number(options.query?.page ?? 0);
  requireValue(Number.isInteger(page) && page >= 0 && page <= 10000);
  const user = state.users.find((u) => u.id === state.currentUserId);
  const context: RequestContext = {
    state,
    path,
    options,
    method: options.method ?? "GET",
    body: (options.body ?? {}) as Record<string, unknown>,
    query: options.query ?? {},
    page,
    parts: path.split("/"),
    user,
  };
  const authResult = await handleAuth(context);
  if (authResult !== UNHANDLED) return authResult;
  requireValue(user, "UNAUTHENTICATED", 401);
  const memberContext = { ...context, user };
  if (path === "audit" && context.method === "GET") {
    requireValue(user.role === "admin", "FORBIDDEN", 403);
    const entries = [...state.audit]
      .reverse()
      .slice(page * 50, (page + 1) * 50);
    return { entries, page, hasMore: state.audit.length > (page + 1) * 50 };
  }
  if (context.parts[0] === "users") return handleUsers(memberContext);
  if (path === "settings") return handleSettings(memberContext);
  requireValue(user.verified || user.role === "admin", "FORBIDDEN", 403);
  if (path === "dashboard" || path === "admin/statistics")
    return handleDashboard(memberContext);
  switch (context.parts[0]) {
    case "bookings":
      return handleBookings(memberContext);
    case "posts":
      return handlePosts(memberContext);
    case "categories":
      return handleCategories(memberContext);
    case "forum":
      return handleForum(memberContext);
    case "images":
      if (context.method === "POST") return upload(options.body);
      if (context.method === "DELETE") return null;
      break;
  }
  throw new ApiError(404, "NOT_FOUND");
}
// Web Locks coordinate browser tabs; the queue also works when Web Locks is unavailable.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(execute: () => Promise<T> | T): Promise<T> {
  const task = async (): Promise<T> =>
    globalThis.navigator?.locks
      ? await navigator.locks.request(
          DEMO_STORAGE_KEY,
          async () => await execute(),
        )
      : await execute();
  const request = queue.then(task, task);
  queue = request.catch(() => undefined);
  return request;
}

export function resetDemo(): Promise<void> {
  return enqueue(() => localStorage.removeItem(DEMO_STORAGE_KEY));
}

export function mockRequest(
  path: string,
  options: Options = {},
): Promise<unknown> {
  return enqueue(async () => {
    options.signal?.throwIfAborted();
    const state = read();
    for (const user of state.users) {
      if (!state.passwords[user.id])
        state.passwords[user.id] = await passwordHash(DEMO_PASSWORD, user.id);
    }
    const previousActor = state.currentUserId;
    const result = await route(state, path, options);
    if (
      options.method &&
      options.method !== "GET" &&
      path !== "auth/csrf" &&
      !path.startsWith("images")
    ) {
      const parts = path.split("/");
      const method = options.method;
      const action =
        parts[0] === "auth"
          ? ({
              login: "auth.login",
              register: "auth.register",
              logout: "auth.logout",
              profile: "profile.update",
              password: "password.change",
            }[parts[1]] ?? path)
          : parts[0] === "users"
            ? parts[2] === "verification"
              ? "member.verify"
              : method === "POST"
                ? "member.create"
                : "member.update"
            : parts[0] === "settings"
              ? "settings.update"
              : parts[0] === "bookings"
                ? parts[2] === "cancel"
                  ? "booking.cancel"
                  : method === "DELETE"
                    ? "booking.delete"
                    : "booking.save"
                : parts[0] === "categories"
                  ? method === "DELETE"
                    ? "category.delete"
                    : "category.save"
                  : parts[0] === "posts"
                    ? parts[2] === "comments"
                      ? method === "DELETE"
                        ? "post.comment.delete"
                        : "post.comment.create"
                      : method === "DELETE"
                        ? "post.delete"
                        : method === "PATCH"
                          ? "post.edit"
                          : "post.create"
                    : parts[0] === "forum"
                      ? parts[2] === "comments"
                        ? method === "DELETE"
                          ? "forum.reply.delete"
                          : "forum.reply.create"
                        : parts[2] === "pin"
                          ? "forum.pin"
                          : method === "DELETE"
                            ? "forum.delete"
                            : method === "PATCH"
                              ? "forum.edit"
                              : "forum.create"
                      : path;
      const actorId =
        path === "auth/login" || path === "auth/register"
          ? state.currentUserId
          : previousActor;
      const actor = state.users.find((member) => member.id === actorId);
      const returned =
        result && typeof result === "object" && "id" in result
          ? String(result.id)
          : "";
      state.audit.push({
        id: (state.audit.at(-1)?.id ?? 0) + 1,
        actorId,
        actorName: actor ? `${actor.firstName} ${actor.lastName}` : "System",
        action,
        target: parts[1] ?? returned,
        createdAt: new Date().toISOString(),
      });
      if (state.audit.length > 2000)
        state.audit.splice(0, state.audit.length - 2000);
    }
    options.signal?.throwIfAborted();
    write(state);
    return structuredClone(result);
  });
}
