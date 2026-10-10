import type { z } from "zod";
import {
  api,
  categorySchema,
  discussionDetailSchema,
  discussionSchema,
  forumSchema,
  imageSchema,
  noContent,
  resultId,
} from "./api";
export type ForumCategory = z.infer<typeof categorySchema>;
export type ForumImage = z.infer<typeof imageSchema>;
export type Discussion = z.infer<typeof discussionSchema>;
export type ForumComment = Discussion["comments"][number];
export type ForumData = z.infer<typeof forumSchema>;
let current: ForumData = {
  categories: [],
  discussions: [],
  page: 0,
  hasMore: false,
};
let filters = { search: "", categoryId: "" };
let listSequence = 0;
export async function getForum(
  page = current.page,
  search = filters.search,
  categoryId = filters.categoryId,
) {
  const seq = ++listSequence;
  filters = { search, categoryId };
  const result = await api("forum", forumSchema, {
    query: { page, search, ...(categoryId ? { categoryId } : {}) },
  });
  if (seq === listSequence) current = result;
  return current;
}
export function getDiscussion(id: string, page = 0, signal?: AbortSignal) {
  return api(`forum/${id}`, discussionDetailSchema, {
    query: { page },
    signal,
  });
}
export async function storeDiscussion(
  input: Pick<Discussion, "title" | "content" | "images" | "categoryId"> & {
    version?: number;
  },
  id?: string,
) {
  const version =
    input.version ??
    (id ? current.discussions.find((d) => d.id === id)?.version : 0);
  await api(id ? `forum/${id}` : "forum", resultId, {
    method: id ? "PATCH" : "POST",
    body: { ...input, version },
  });
  return getForum();
}
export async function replyToDiscussion(
  id: string,
  content: string,
  images: ForumImage[],
) {
  await api(`forum/${id}/comments`, noContent, {
    method: "POST",
    body: { content, images },
  });
  return getForum();
}
export async function moderateDiscussion(
  id: string,
  action: "pin" | "delete",
  version?: number,
  pinned?: boolean,
) {
  const d = current.discussions.find((d) => d.id === id);
  await api(`forum/${id}${action === "pin" ? "/pin" : ""}`, noContent, {
    method: action === "pin" ? "PATCH" : "DELETE",
    body:
      action === "pin"
        ? { pinned: !(pinned ?? d?.pinned), version: version ?? d?.version }
        : undefined,
  });
  return getForum();
}
export async function deleteReply(id: string, commentId: string) {
  await api(`forum/${id}/comments/${commentId}`, noContent, {
    method: "DELETE",
  });
  return getForum();
}
export async function storeCategory(name: string, id?: string) {
  await api(id ? `categories/${id}` : "categories", categorySchema, {
    method: id ? "PATCH" : "POST",
    body: {
      name,
      version: id ? current.categories.find((c) => c.id === id)?.version : 0,
    },
  });
  return getForum();
}
export async function removeCategory(id: string, replacement: string) {
  await api(`categories/${id}`, noContent, {
    method: "DELETE",
    body: {
      replacement,
      version: current.categories.find((c) => c.id === id)?.version,
    },
  });
  return getForum();
}
