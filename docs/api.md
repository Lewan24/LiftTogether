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
| GET /users?page=0                           | Admin                               | Member profiles, 50 per page                                    |
| PATCH /users/{id}/verification              | Admin                               | `{verified, version}`; revoke access immediately when false     |
| PATCH /settings                             | Admin                               | Gym settings with version                                       |
| GET /bookings?from=...&to=...               | Verified member/admin               | Booking range, up to 92 days                                    |
| POST /bookings                              | Verified member/admin               | `{date,start,end,version?}` for current user                    |
| PATCH /bookings/{id}                        | Owner/admin                         | Edit times with version and unchanged date                      |
| POST /bookings/{id}/cancel                  | Owner/admin                         | Cancel; members only within current week                        |
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
| GET /audit?page=0                           | Admin                               | Paginated security/management audit events                      |

`GET /health/live` checks process liveness; `GET /health/ready` checks database connectivity without revealing configuration.

## DTOs and limits

Profile: `firstName`, `lastName`, `email`, `dormitory`, `room`, `facebookUrl`, `phone`, `version`. Password registration length is 12-128; other profile text is bounded to 100 and email/Facebook URLs to 254 characters. Roles, owner IDs, hashes and verification are never writable through profile/registration DTOs. Unknown JSON properties do not grant permissions.

Settings: `gymName`, `dormitoryName`, `maxDaily` (1-100), `registrationEnabled`, `defaultCalendarView` (`week` or `month`), `version`.

Announcements: `titlePl`, `titleEn` (200 each), `contentPl`, `contentEn` (10,000 each), `status` (`draft` or `published`), `important`, `version` on update. Announcement content is plain text; forum content is sanitized rich text.

Discussion title is 200 characters; rich HTML is bounded to 50,000 before sanitization. Only paragraphs, line breaks, h2/h3, basic emphasis, lists, quotes and code are preserved; arbitrary attributes, scripts, embeds and links are stripped. Posts/replies need visible text or an image.

Upload returns `{id,name,src}`. Send returned image metadata in `images`, at most four distinct image IDs per post/reply. The server ignores client name/src values and resolves IDs to owned, unattached uploads or images already attached to the edited discussion. Cross-owner reassignment is rejected. Allowed encoded formats are decoded, dimension-checked (6,000 per axis, 16 million pixels total), resized to at most 1,600 pixels and re-encoded as JPEG with metadata removed. Original files are not served.

Page wrappers include `page` and `hasMore`. Forum list has `categories` and `discussions`; user list has `users`; announcement list has `posts`. Detail wrappers have `discussion` or `post`. Counts use `commentCount`, because detail comments are paginated.

## Errors

JSON failures include `{code,traceId}` with no stack trace or database error details. Typical statuses: 400 invalid input/CSRF, 401 unauthenticated, 403 forbidden/pending verification, 404 hidden or missing record, 409 capacity/duplicate/stale version, 429 rate limit, 500 unexpected server failure. `Retry-After: 60` accompanies throttling. The React app keeps editors open on failure and shows a message; stale edits require reload before retry. Request bodies are capped at 3 MiB at the proxy and API.
