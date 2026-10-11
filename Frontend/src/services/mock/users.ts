import {
  requireValue,
  profile,
  passwordInput,
  passwordHash,
  version,
  paginate,
  find,
  type MemberContext,
} from "./state.ts";
import { ApiError } from "../http.ts";

export async function handleUsers(context: MemberContext): Promise<unknown> {
  const { state, path, method, body, page, parts, user } = context;
  const admin = () => requireValue(user.role === "admin", "FORBIDDEN", 403);
  admin();
  if (path === "users" && method === "GET") {
    const result = paginate(state.users, page);
    return { ...result, users: result.items };
  }
  if (
    (path === "users" && method === "POST") ||
    (parts.length === 2 && method === "PATCH")
  ) {
    const existing =
      method === "PATCH" ? find(state.users, parts[1]) : undefined;
    if (existing) version(body, existing);
    const fields = profile(body);
    requireValue(typeof body.verified === "boolean");
    requireValue(
      !existing || existing.role !== "admin" || body.verified,
      "ADMIN_VERIFICATION",
    );
    requireValue(
      !state.users.some(
        (member) => member.email === fields.email && member.id !== existing?.id,
      ),
      "EMAIL_IN_USE",
      409,
    );
    const member = existing ?? {
      ...fields,
      id: crypto.randomUUID(),
      role: "user" as const,
      verified: false,
      version: 0,
    };
    if (!existing || body.password) {
      const password = passwordInput(body.password);
      requireValue(password.length >= 12, "PASSWORD_LENGTH");
      state.passwords[member.id] = await passwordHash(password, member.id);
      if (state.currentUserId === member.id) state.currentUserId = null;
    }
    Object.assign(member, fields, {
      verified: body.verified,
      version: member.version + 1,
    });
    if (!existing) state.users.push(member);
    return member;
  }
  if (parts[2] === "verification" && method === "PATCH") {
    const member = find(state.users, parts[1]);
    version(body, member);
    requireValue(member.role !== "admin" && typeof body.verified === "boolean");
    member.verified = body.verified;
    member.version++;
    return member;
  }
  throw new ApiError(404, "NOT_FOUND");
}
