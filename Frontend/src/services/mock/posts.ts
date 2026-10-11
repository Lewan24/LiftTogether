import {
  now,
  name,
  initials,
  requireValue,
  text,
  version,
  paginate,
  nextId,
  find,
  remove,
  type MemberContext,
} from "./state.ts";
import { ApiError } from "../http.ts";

export async function handlePosts(context: MemberContext): Promise<unknown> {
  const { state, path, method, body, page, parts, user } = context;
  const admin = () => requireValue(user.role === "admin", "FORBIDDEN", 403);
  const owner = (id: string) =>
    requireValue(user.role === "admin" || user.id === id, "FORBIDDEN", 403);
  if (path === "posts" && method === "GET") {
    const result = paginate(
      state.posts
        .filter((p) => user.role === "admin" || p.status === "published")
        .sort((a, b) => b.id - a.id),
      page,
    );
    return {
      ...result,
      posts: result.items.map((p) => ({
        ...p,
        comments: [],
        commentCount: p.comments.length,
      })),
    };
  }
  const post = parts[1] ? find(state.posts, parts[1]) : undefined;
  requireValue(
    !post || user.role === "admin" || post.status === "published",
    "NOT_FOUND",
    404,
  );
  if (parts[2] === "comments" && post) {
    if (method === "POST") {
      post.comments.unshift({
        id: nextId(post.comments),
        userId: user.id,
        author: name(user),
        initials: initials(user),
        content: text(body.content, 2000),
        createdAt: now(),
      });
      post.commentCount = post.comments.length;
      return null;
    }
    if (method === "DELETE") {
      const comment = find(post.comments, parts[3]);
      owner(comment.userId);
      remove(post.comments, comment);
      post.commentCount = post.comments.length;
      return null;
    }
  }
  if (method === "GET" && post) {
    const result = paginate(post.comments, page);
    return {
      post: {
        ...post,
        comments: result.items,
        commentCount: post.comments.length,
      },
      page,
      hasMore: result.hasMore,
    };
  }
  admin();
  if (method === "DELETE" && post) {
    remove(state.posts, post);
    return null;
  }
  requireValue(method === "POST" || method === "PATCH");
  if (post) version(body, post);
  requireValue(body.status === "published" || body.status === "draft");
  const fields = {
    titlePl: text(body.titlePl, 200),
    titleEn: text(body.titleEn, 200),
    contentPl: text(body.contentPl, 10000),
    contentEn: text(body.contentEn, 10000),
    status: body.status as "published" | "draft",
    important: body.important === true,
  };
  if (post) {
    Object.assign(post, fields, { version: post.version + 1 });
    return post;
  }
  const created = {
    ...fields,
    id: nextId(state.posts),
    createdAt: now(),
    author: name(user),
    version: 1,
    comments: [],
    commentCount: 0,
  };
  state.posts.push(created);
  return created;
  throw new ApiError(404, "NOT_FOUND");
}
