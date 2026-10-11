import { z } from "zod";
import { isDemoMode } from "./mode.ts";

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
  nextWeekReleaseDay: z.number().int().min(0).max(6).default(0),
  nextWeekReleaseTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("18:00"),
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
  src: z
    .string()
    .regex(
      isDemoMode
        ? /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/
        : /^\/api\/images\/[0-9a-f-]{36}$/i,
    ),
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

export const auditEntrySchema = z.object({
  id: z.number().int(),
  actorId: z.string().uuid().nullable(),
  actorName: z.string(),
  action: z.string(),
  target: z.string(),
  createdAt: z.string(),
});
export const auditPageSchema = z.object({
  entries: z.array(auditEntrySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const dashboardSchema = z.object({
  from: z.string(),
  to: z.string(),
  forumTopics: z.number().int().nonnegative(),
  forumReplies: z.number().int().nonnegative(),
  newsPosts: z.number().int().nonnegative(),
  latestTopics: z.array(z.object({ id: z.string().uuid(), title: z.string() })),
  latestNews: z.array(
    z.object({
      id: z.number().int(),
      titlePl: z.string(),
      titleEn: z.string(),
    }),
  ),
});
export const statisticsSchema = z.object({
  period: z.enum(["week", "month"]),
  from: z.string(),
  to: z.string(),
  totalUsers: z.number().int().nonnegative(),
  verifiedMembers: z.number().int().nonnegative(),
  pendingMembers: z.number().int().nonnegative(),
  forumTopics: z.number().int().nonnegative(),
  periodForumTopics: z.number().int().nonnegative(),
  periodNewsPosts: z.number().int().nonnegative(),
  bookings: z.number().int().nonnegative(),
  cancelledBookings: z.number().int().nonnegative(),
  trainingMembers: z.number().int().nonnegative(),
  averageDailyBookings: z.number().nonnegative(),
  busiestWeekday: z.number().int().min(0).max(6).nullable(),
  capacity: z.number().int().positive(),
  daily: z.array(
    z.object({
      date: z.string(),
      weekday: z.number().int().min(0).max(6),
      bookings: z.number().int().nonnegative(),
    }),
  ),
  weekdays: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      average: z.number().nonnegative(),
      bookings: z.number().int().nonnegative(),
      days: z.number().int().positive(),
    }),
  ),
});
export type DashboardSummary = z.infer<typeof dashboardSchema>;
export type AdminStatisticsData = z.infer<typeof statisticsSchema>;
