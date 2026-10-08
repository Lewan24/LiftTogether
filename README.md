# Lift Together

React 19, TypeScript, Vite and Tailwind CSS 4. Run npm install, npm run dev, npm run build, npm test. Node 24 is recommended. The build includes strict TypeScript checks.

## Architecture

App.tsx coordinates session and page state. Screens are lazy loaded from pages/. Shared navigation, booking cards, dialogs and errors live in components/. Domain rules live in lib/. services/storage.ts is an in-memory demo repository; services/http.ts is an API transport factory with runtime response decoders, same-origin cookies, CSRF tokens, cancellation and timeouts. The transport is intentionally not wired to an invented backend. Replace synchronous demo calls with asynchronous domain repositories and loading/error states when an API contract exists.

## Demo limitations

Demo credentials are public sample credentials. Accounts, passwords and session selection are memory-only and reset on reload. Old v4 localStorage demo data is removed on first initialization. Language is the only persisted preference. Browser role checks improve UX and are not an authorization boundary. Use only sample data. Registration requires at least eight characters. Booking rules allow one daily member session, 30?120 minutes, half-hour increments, from 06:00 to midnight, with capacity checks. API must enforce these rules transactionally.

Password recovery, remember-me and attachments require backend implementations. User creation uses registration, not an inert administrator button. Booking activity is derived booking history, not a security audit log.

## Backend and deployment security

Follow OWASP Top 10:2025 and ASVS. Enforce object-level and role-based authorization for every endpoint; never accept client role, verification, ownership or price fields as authority. Use Secure, HttpOnly, SameSite session cookies, rotation, expiry, logout revocation and CSRF protection. Hash passwords server-side with Argon2id, rate-limit authentication and recovery, and issue short-lived one-use recovery tokens. Validate bounded DTOs and response schemas; use parameterized database queries. Return generic client errors and send redacted structured security events to protected server logs.

Serve HTTPS with HSTS, X-Content-Type-Options: nosniff, Referrer-Policy and Permissions-Policy. Configure CSP and frame-ancestors as response headers at your hosting layer. Start with default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'. Current Google Fonts need style-src https://fonts.googleapis.com and font-src https://fonts.gstatic.com; inline occupancy widths need an explicit style policy or a CSS refactor. Test CSP in report-only mode before enforcement. Self-host fonts for a stricter policy. No secrets belong in VITE_ environment variables or frontend bundles.

For attachments, validate size and content signatures, scan uploads, store outside executable paths and use authorized download endpoints. Keep an audited lockfile, review dependency updates in CI, run build/tests/audit, and establish backups and incident response. These server and infrastructure controls cannot be implemented by this frontend alone.

References: https://top10.owasp.org/2025/ and https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
