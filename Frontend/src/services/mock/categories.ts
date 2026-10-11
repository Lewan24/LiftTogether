import {
  requireValue,
  text,
  version,
  find,
  remove,
  type MemberContext,
} from "./state.ts";

export async function handleCategories(
  context: MemberContext,
): Promise<unknown> {
  const { state, method, body, parts, user } = context;
  const admin = () => requireValue(user.role === "admin", "FORBIDDEN", 403);
  admin();
  const category = parts[1] ? find(state.categories, parts[1]) : undefined;
  if (category) version(body, category);
  if (method === "DELETE" && category) {
    const replacement = find(state.categories, String(body.replacement));
    requireValue(replacement.id !== category.id);
    state.discussions
      .filter((d) => d.categoryId === category.id)
      .forEach((d) => {
        d.categoryId = replacement.id;
        d.version++;
      });
    remove(state.categories, category);
    return null;
  }
  requireValue(method === "POST" || method === "PATCH");
  const categoryName = text(body.name, 80);
  requireValue(
    !state.categories.some(
      (c) =>
        c.id !== category?.id &&
        c.name.toLowerCase() === categoryName.toLowerCase(),
    ),
    "DUPLICATE_CATEGORY",
    409,
  );
  if (category) {
    category.name = categoryName;
    category.version++;
    return category;
  }
  const created = { id: crypto.randomUUID(), name: categoryName, version: 1 };
  state.categories.push(created);
  return created;
}
