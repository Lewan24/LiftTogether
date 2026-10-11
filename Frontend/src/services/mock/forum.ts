import {
  now,
  name,
  requireValue,
  text,
  version,
  sanitize,
  paginate,
  find,
  remove,
  images,
  type MemberContext,
} from "./state.ts";
import { ApiError } from "../http.ts";

export async function handleForum(context: MemberContext): Promise<unknown> {
  const { state, path, method, body, query, page, parts, user } = context;
  const admin = () => requireValue(user.role === "admin", "FORBIDDEN", 403);
  const owner = (id: string) =>
    requireValue(user.role === "admin" || user.id === id, "FORBIDDEN", 403);
  if (path === "forum" && method === "GET") {
    const result = paginate(
      state.discussions
        .filter(
          (d) =>
            (!query.categoryId || d.categoryId === query.categoryId) &&
            d.title
              .toLowerCase()
              .includes(String(query.search ?? "").toLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
      page,
    );
    return {
      ...result,
      discussions: result.items.map((d) => ({
        ...d,
        comments: [],
        images: [],
        commentCount: d.comments.length,
      })),
      categories: state.categories.map((c) => ({
        ...c,
        discussionCount: state.discussions.filter((d) => d.categoryId === c.id)
          .length,
      })),
    };
  }
  const discussion = parts[1] ? find(state.discussions, parts[1]) : undefined;
  if (method === "GET" && discussion) {
    const result = paginate(discussion.comments, page);
    return {
      discussion: {
        ...discussion,
        comments: result.items,
        commentCount: discussion.comments.length,
      },
      page,
      hasMore: result.hasMore,
    };
  }
  if (parts[2] === "pin" && discussion && method === "PATCH") {
    admin();
    version(body, discussion);
    discussion.pinned = body.pinned === true;
    discussion.version++;
    return null;
  }
  if (parts[2] === "comments" && discussion) {
    if (method === "DELETE") {
      const comment = find(discussion.comments, parts[3]);
      owner(comment.userId);
      remove(discussion.comments, comment);
      discussion.commentCount = discussion.comments.length;
      return null;
    }
    if (method === "POST") {
      const content = await sanitize(body.content);
      const attachments = images(body);
      requireValue(
        content.replace(/<[^>]*>/g, "").trim() || attachments.length,
        "EMPTY_CONTENT",
      );
      discussion.comments.unshift({
        id: crypto.randomUUID(),
        userId: user.id,
        author: name(user),
        content,
        images: attachments,
        createdAt: now(),
      });
      discussion.commentCount = discussion.comments.length;
      return null;
    }
  }
  if (method === "DELETE" && discussion) {
    admin();
    remove(state.discussions, discussion);
    return null;
  }
  requireValue(method === "POST" || method === "PATCH");
  if (discussion) {
    owner(discussion.userId);
    version(body, discussion);
  }
  const category = find(state.categories, String(body.categoryId));
  const content = await sanitize(body.content);
  const attachments = images(body);
  requireValue(
    content.replace(/<[^>]*>/g, "").trim() || attachments.length,
    "EMPTY_CONTENT",
  );
  const fields = {
    title: text(body.title, 200),
    content,
    categoryId: category.id,
    images: attachments,
  };
  if (discussion) {
    Object.assign(discussion, fields, { version: discussion.version + 1 });
    return { id: discussion.id };
  }
  const created = {
    ...fields,
    id: crypto.randomUUID(),
    userId: user.id,
    author: name(user),
    pinned: false,
    createdAt: now(),
    version: 1,
    comments: [],
    commentCount: 0,
  };
  state.discussions.unshift(created);
  return { id: created.id };
  throw new ApiError(404, "NOT_FOUND");
}
