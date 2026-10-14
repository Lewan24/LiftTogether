# API contract

All browser requests use same-origin `/api`. Authenticated sessions are carried in the HttpOnly `lift-session` cookie. Acquire `GET /api/auth/csrf` and send its `token` as `X-CSRF-Token` on every POST, PATCH and DELETE, including login, registration, logout and multipart uploads. Acquire a new token after login, password change or logout because the identity changed. Responses have camelCase JSON fields; successful deletes return 204. Dates use `yyyy-MM-dd`, booking times use `HH:mm` (including `24:00` as an end), and timestamps use UTC ISO 8601.

| Endpoint                                    | Access                              | Behavior                                                        |
| ------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| GET /public                                 | Public                              | Public gym settings                                             |
| GET /auth/csrf                              | Public                              | Issue CSRF cookie/request token                                 |
| GET /auth/me                                | Public                              | Current user or JSON null                                       |
| POST /auth/register                         | Public, rate limited                | Profile + password, creates pending member and session          |
| POST /auth/login                            | Public, rate limited                | Email/password; returns current user                            |
| POST /auth/logout                           | CSRF                                | Revoke current session and remove cookie                        |
| PATCH /auth/profile                         | Authenticated                       | Edit own profile with version; never role/verification          |
| POST /auth/password                         | Authenticated, rate limited         | Current/new password; revoke all sessions and issue a fresh one |
| GET /users?page=0&role=admin                           | Admin                               | Profiles and private notes, 50 per page; optional role filter                                    |
| POST /users                              | Admin                               | Create member with profile, password and verification status    |
| PATCH /users/{id}                          | Admin                               | Edit profile/verification/`adminNotes`; optional password reset; version      |
| PATCH /users/{id}/verification              | Admin                               | `{verified, version}`; revoke access immediately when false     |
| PATCH /settings                             | Admin                               | Gym settings with version                                       |
| GET /bookings?from=...&to=...               | Verified member/admin               | Booking range, up to 92 days                                    |
| POST /bookings                              | Verified member/admin               | `{date,start,end,version?}` for current user                    |
| PATCH /bookings/{id}                        | Owner/admin                         | Edit times with version and unchanged date                      |
| POST /bookings/{id}/cancel                  | Owner/admin                         | Cancel; members only within the open booking window                        |
| DELETE /bookings/{id}                       | Admin                               | Remove booking                                                  |
| GET /posts?page=0                           | Verified member/admin               | Announcements; admins also see drafts                           |
| GET /posts/{id}?page=0                      | Verified member/admin               | Post and one page of comments                                   |
| POST /posts                                 | Admin                               | Announcement fields; author/status controlled and validated     |
| PATCH /posts/{id}                           | Admin                               | Announcement fields plus version                                |
| DELETE /posts/{id}                          | Admin                               | Delete announcement and comments                                |
| POST /posts/{id}/comments                   | Verified member/admin               | `{content}`, maximum 2,000 characters                           |
| DELETE /posts/{id}/comments/{id}            | Comment owner/admin                 | Delete comment                                                  |
| GET /forum?page=0&search=...&categoryId=... | Verified member/admin               | Categories and pinned-first discussion feed                     |
| GET /forum/{id}?page=0                      | Verified member/admin               | Rich text, attached image metadata and replies                  |
| POST /forum                                 | Verified member/admin               | `{title,content,categoryId,images}`                             |
| PATCH /forum/{id}                           | Author/admin                        | Same fields plus version                                        |
| PATCH /forum/{id}/pin                       | Admin                               | `{pinned,version}`                                              |
| DELETE /forum/{id}                          | Admin                               | Delete discussion, replies and images                           |
| POST /forum/{id}/comments                   | Verified member/admin               | `{content,images}`                                              |
| DELETE /forum/{id}/comments/{id}            | Reply author/admin                  | Delete reply and images                                         |
| POST /categories                            | Admin                               | `{name}`                                                        |
| PATCH /categories/{id}                      | Admin                               | `{name,version}`                                                |
| DELETE /categories/{id}                     | Admin                               | JSON body `{replacement,version}`; transactional reassignment   |
| POST /images                                | Verified member/admin, rate limited | Multipart field `file`; one PNG/JPEG/WebP up to 2 MiB           |
| GET /images/{id}                            | Verified member/admin               | Attached image or own unattached image, JPEG                    |
| DELETE /images/{id}                         | Owner                               | Remove an unattached image                                      |
| GET /dashboard                           | Verified member/admin              | Current-week forum/news counts and latest published content      |
| GET /admin/statistics?period=week&date=2026-10-11 | Admin                         | Complete week/month bookings, users, forum and weekday averages  |
| GET /audit?page=0                           | Admin                               | Paginated security/management audit events                      |

`GET /health/live` checks process liveness; `GET /health/ready` checks database connectivity without revealing configuration.

## DTOs and limits

Profile: `firstName`, `lastName`, `email`, `dormitory`, `room`, `facebookUrl`, `phone`, `version`. Password registration length is 12-128; other profile text is bounded to 100 and email/Facebook URLs to 254 characters. Roles, owner IDs, hashes and verification are never writable through profile/registration DTOs. Unknown JSON properties do not grant permissions.

Settings: `gymName`, `dormitoryName`, `maxDaily` (1-100), `registrationEnabled`, `defaultCalendarView` (`week` or `month`), `nextWeekReleaseDay` (0=Sunday through 6=Saturday), `nextWeekReleaseTime` (`HH:mm`), `version`. Next week opens at this configured Europe/Warsaw time; defaults to Sunday 18:00. Only today and future dates within the released weeks are bookable by members; past bookings are read-only. Create/edit/cancel use the same booking window; administrators can manage any week.

Announcements: `titlePl`, `titleEn` (200 each), `contentPl`, `contentEn` (10,000 each), `status` (`draft` or `published`), `important`, `version` on update. Announcement content is plain text; forum content is sanitized rich text.

Discussion title is 200 characters; rich HTML is bounded to 50,000 before sanitization. Only paragraphs, line breaks, h2/h3, basic emphasis, lists, quotes and code are preserved; arbitrary attributes, scripts, embeds and links are stripped. Posts/replies need visible text or an image.

Upload returns `{id,name,src}`. Send returned image metadata in `images`, at most four distinct image IDs per post/reply. The server ignores client name/src values and resolves IDs to owned, unattached uploads or images already attached to the edited discussion. Cross-owner reassignment is rejected. Allowed encoded formats are decoded, dimension-checked (6,000 per axis, 16 million pixels total), resized to at most 1,600 pixels and re-encoded as JPEG with metadata removed. Original files are not served.

Page wrappers include `page` and `hasMore`. Forum list has `categories` and `discussions`; user list has `users`; audit list has `entries` (actor ID/name, action, target and actual timestamp); announcement list has `posts`. Detail wrappers have `discussion` or `post`. Counts use `commentCount`, because detail comments are paginated.

## Errors

JSON failures include `{code,traceId}` with no stack trace or database error details. Typical statuses: 400 invalid input/CSRF, 401 unauthenticated, 403 forbidden/pending verification, 404 hidden or missing record, 409 capacity/duplicate/stale version, 429 rate limit, 500 unexpected server failure. `Retry-After: 60` accompanies throttling. The React app keeps editors open on failure and shows a message; stale edits require reload before retry. Request bodies are capped at 3 MiB at the proxy and API.

Booking cancellation requires a JSON body `{ "version": <current booking version> }`; stale versions return HTTP 409 (`CONFLICT_REFRESH`).

Admin member create/edit accepts the profile fields plus `verified`, `password` and `version` (updates). Creation requires a 12–128 character password; omit it or send an empty string on updates to preserve the existing password. Password changes invalidate all of the target member’s sessions. Roles cannot be changed through these endpoints; new members always have role `user`. Administrator accounts cannot be unverified.

Dashboard statistics accept `period=week` (default) or `month`, with an optional ISO calendar `date` (2000–2100). Counts cover all database records, independent of list pagination. Reservations exclude cancellations; weekday averages include every matching calendar day in the selected period, including future and empty days. Total app accounts include administrators; verified/pending counts describe ordinary members. Forum totals count topics, not replies. `/dashboard` is limited to the current Warsaw week and published news, and includes forum reply counts. These statistics describe reservations, not measured attendance.

`role` on the admin user list is optional and accepts `admin` or `user`; filtering happens before pagination. Admin user responses include `adminNotes` (up to 4000 characters). Omitting `adminNotes` in an admin update preserves the existing note; an empty string clears it. Authentication and self-profile responses never include this field.

For `auth.login.failed`, the audit `target` contains JSON with `email`, `accountId` and `accountRole`; unmatched accounts have null ID/role. `actorId` is null. Older entries contain `redacted` and do not identify the attempted account.

Admin create/edit inputs accept optional `role` (`user` or `admin`). Omission preserves the existing role (new accounts default to `user`). Administrator accounts must be verified. Role changes revoke the affected account’s sessions and emit `member.role` audit events; demoting the last administrator returns `LAST_ADMIN` (409).

## Personal training and statistics

Verified members and administrators can use `GET /api/profile/stats` and `GET /api/profile/trainings?page=0`. Both always use the authenticated account; no client-supplied user ID selects another member. History is newest first, 50 bookings per page, with `page` and `hasMore` and normal validated page bounds. Booking responses include nullable `completedAt`.

`POST /api/bookings/{id}/complete` takes `{ "version": <current booking version> }`, requires CSRF and verified access, and permits the owner or an administrator. Only non-cancelled, uncompleted bookings whose end time has passed in Europe/Warsaw can be confirmed; `24:00` ends at the following midnight. Repeated or stale requests return 409. Completion records `booking.complete` atomically with the booking update. Completed bookings cannot be edited or cancelled; administrators retain their existing delete permission.

Stats return `completedTrainings`, `trainingMinutes`, `scheduledBookings` (all non-cancelled reservations, including completed and future), `cancelledBookings`, `forumPosts`, `forumComments` (forum replies only), nullable `mostPopularPost` (`id`, `title`, `replies` from other members), and seven `weekdays` (`weekday`: Sunday=0, `scheduled`, `cancelled`, `completed`, `percentage`). Popularity sorts by other members' replies with ID as a stable tie breaker. Weekday percentages divide each day's non-cancelled bookings by all non-cancelled bookings, rounded to one decimal; no bookings yields zero. Tied favourite weekdays are all highlighted. Cancellation is the existing booking status; there is no rejected-booking workflow.
