import {
  requireValue,
  text,
  passwordInput,
  version,
  passwordHash,
  profile,
  UNHANDLED,
  type RequestContext,
} from "./state.ts";
import type { User } from "./state.ts";

export async function handleAuth(context: RequestContext): Promise<unknown> {
  const { state, path, method, body, user } = context;
  if (path === "public" && method === "GET") return state.settings;
  if (path === "auth/me" && method === "GET") return user ?? null;
  if (path === "auth/logout" && method === "POST") {
    state.currentUserId = null;
    return null;
  }
  if (path === "auth/login" && method === "POST") {
    const candidate = state.users.find(
      (u) => u.email === text(body.email, 254).toLowerCase(),
    );
    const password = passwordInput(body.password);
    requireValue(candidate, "INVALID_CREDENTIALS", 401);
    const stored = state.passwords[candidate.id];
    requireValue(
      stored === (await passwordHash(password, candidate.id)),
      "INVALID_CREDENTIALS",
      401,
    );
    state.currentUserId = candidate.id;
    return candidate;
  }
  if (path === "auth/register" && method === "POST") {
    requireValue(
      state.settings.registrationEnabled,
      "REGISTRATION_DISABLED",
      403,
    );
    const fields = profile(body);
    const password = passwordInput(body.password);
    requireValue(password.length >= 12, "PASSWORD_LENGTH");
    requireValue(
      !state.users.some((u) => u.email === fields.email),
      "REGISTRATION_FAILED",
      409,
    );
    const member: User = {
      ...fields,
      id: crypto.randomUUID(),
      role: "user",
      verified: false,
      version: 1,
    };
    state.passwords[member.id] = await passwordHash(password, member.id);
    state.users.push(member);
    state.currentUserId = member.id;
    return member;
  }
  requireValue(user, "UNAUTHENTICATED", 401);
  if (path === "auth/profile" && method === "PATCH") {
    version(body, user);
    const fields = profile(body);
    requireValue(
      !state.users.some((u) => u.id !== user.id && u.email === fields.email),
      "DUPLICATE_RECORD",
      409,
    );
    Object.assign(user, fields, { version: user.version + 1 });
    return user;
  }
  if (path === "auth/password" && method === "POST") {
    const current = passwordInput(body.currentPassword);
    const password = passwordInput(body.newPassword);
    requireValue(password.length >= 12, "PASSWORD_LENGTH");
    requireValue(
      state.passwords[user.id] === (await passwordHash(current, user.id)),
      "INVALID_CREDENTIALS",
    );
    state.passwords[user.id] = await passwordHash(password, user.id);
    return null;
  }
  return UNHANDLED;
}
