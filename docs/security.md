# Security and performance

This implementation uses the [OWASP Top 10:2025](https://top10.owasp.org/2025/) as a design checklist. It is not a penetration-test report or a compliance certification.

| Risk                                       | Implemented controls                                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control                  | Server policies for authenticated/verified/admin access; ownership checks for bookings, discussions and replies; drafts hidden from members; upload access and attachment ownership validated; current database role/verification used on every request |
| A02 Security Misconfiguration              | Same-origin topology, no permissive CORS, production Secure/HttpOnly/SameSite cookies, restricted trusted proxy networks, non-root API/frontend containers, localhost-only tooling, no production API/DB port publication                               |
| A03 Software Supply Chain Failures         | npm/NuGet lockfiles, exact managed dependencies, release builds tested in Docker, dependency audits and documented update process                                                                                                                       |
| A04 Cryptographic Failures                 | 256-bit random session tokens with only SHA-256 hashes in DB; ASP.NET PasswordHasher PBKDF2 with 600,000 iterations; secrets outside source; TLS required at deployment edge                                                                            |
| A05 Injection                              | Parameterized EF Core/Npgsql queries, bounded DTO validation, allowlisted HTML sanitization server-side and DOMPurify rendering, file decoding/re-encoding instead of trusting extensions or MIME headers                                               |
| A06 Insecure Design                        | Transactional daily capacity, unique member/date constraint, optimistic versions, no client-controlled roles or owners, explicit category reassignment, pending registration verification                                                               |
| A07 Authentication Failures                | Eight-hour server sessions, login/registration rate limits, dummy PBKDF2 verification for unknown email, password-change revocation of all previous sessions, logout revocation, no browser token storage                                               |
| A08 Software or Data Integrity Failures    | Authenticated mutation endpoints, CSRF validation including login/uploads, foreign keys/constraints, revision checks, migration job separated from runtime                                                                                              |
| A09 Security Logging and Alerting Failures | Persistent management/auth audit events with IDs only; trace IDs on generic errors; no credential/body logging; runtime database role cannot edit/delete audit rows                                                                                     |
| A10 Mishandling of Exceptional Conditions  | Uniform status/code responses, cancellation, timeouts, size limits, checked conflicts, no stack traces in HTTP, editors preserved on failed saves                                                                                                       |

CSRF follows [ASP.NET Core antiforgery guidance](https://learn.microsoft.com/aspnet/core/security/anti-request-forgery). Session cookies have an `/api` path and strict same-site policy. CSRF request tokens are kept in JS memory, refreshed on identity transitions, and paired with an HttpOnly cookie. Role/verification checks read the database on every authenticated request, so suspension takes effect without waiting for a cookie to expire. Server identity governs author and owner fields.

## Image handling

Uploads are at most 2 MiB; 3 MiB body limits allow multipart overhead. Only actual JPEG, PNG and WebP encodings are accepted after codec identification; SVG and arbitrary files are rejected. Dimensions are limited before pixel allocation. Decode concurrency is limited to two operations per API instance. Images are resized to a maximum of 1,600 pixels, re-encoded as JPEG, and stored outside executable/static paths in PostgreSQL. Source metadata and animation are removed. Each member is limited to 48 uploads per day and 12 upload requests per minute. Unattached images are visible only to their uploader and are cleaned after 24 hours; attached images are readable by verified members.

This is format normalization, not antivirus scanning. Add a malware scanning service and isolate codecs further if deployment risk requires it. Monitor storage growth and keep [SkiaSharp](https://github.com/mono/SkiaSharp) patched. Pixel and request limits are enforced independently of client-side controls.

## Performance choices

- Database-side counts and filters, calendar/pagination indexes, no-tracking reads, bounded list sizes and time ranges.
- Feed images are references, never inline base64; binary image content is retrieved separately.
- Foreign keys cascade discussion/reply deletion; category moves use a transactional bulk update.
- Daily booking advisory locks work across API replicas and prevent overbooking under contention.
- PostgreSQL `xmin` checks prevent stale updates. Npgsql documents [database concurrency tokens](https://www.npgsql.org/efcore/modeling/concurrency.html).
- Frontend pages are lazy loaded; independent initial requests run concurrently. Fetch is cancellable and times out after 15 seconds. Only language is stored locally.
- Password hashing is deliberately expensive; rate limits bound authentication work. Connection pools and SQL timeouts are configured; upload decoding is concurrency-limited.
- Static assets are cached by hashed URL; user/API responses use `no-store`. Nginx compresses text assets.

## Production responsibilities

Terminate TLS with HTTP-to-HTTPS redirects and HSTS at your trusted edge. Do not expose the internal HTTP frontend directly: Secure cookies need forwarded HTTPS. Restrict `APP_HOST` and trusted proxy networks. `.env`, Docker secrets and Data Protection keys must be protected by host permissions and backups; keys on the volume are not automatically encrypted at rest. Pin deployment images by digest, scan them, limit container resources, and add monitoring/alerting for login failures, 429s, 5xx responses, storage usage and database latency.

The application limiter is local to each API replica; enforce distributed/edge limits when scaling. Audit retention and encrypted backups are operator policies, not automatic deletion. Ordinary members can see names on bookings and forum posts; emails, phone numbers, dorm/room details are returned only for their own profile or to admins. Choose retention and privacy policies before collecting real member data.

CSP is set at Nginx. Current typography uses Google Fonts and inline styles from the UI, so those style/font sources and `style-src 'unsafe-inline'` are permitted; JavaScript remains same-origin with no inline script allowance. Self-host fonts and remove inline styling if a stricter CSP is required. Security headers must also be configured at any alternate hosting layer. Keep Adminer on localhost/SSH tunnels and disable its profile normally.

Email recovery, MFA and external identity providers are not implemented. Do not invent a publicly accessible password reset without verified delivery and one-use tokens. Signed-in users can change passwords; documented operator administrator recovery requires privileged deployment access and revokes old sessions.
