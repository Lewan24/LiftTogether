# Lift Together

A campus gym application with a React 19 frontend, a .NET 10 minimal API, and PostgreSQL 18 persistence. Browser refreshes and API restarts preserve accounts, bookings, announcements, discussions, comments, categories, and images.

## Features

- Register, sign in, restore sessions, update profiles, and change passwords. New members wait for administrator verification.
- Book one session per person per day, in 30-minute intervals between 06:00 and midnight, for up to **3 hours**. The default limit is **12 distinct people across the whole day**.
- View weekly and monthly schedules, edit bookings, cancel a session, and review daily occupancy. Administrators can manage other members' bookings.
- Publish announcements or save drafts; members can comment on published announcements.
- Create forum discussions and replies with headings, bold/italic text, lists, and image attachments. Filter discussions by category or search titles, with paginated results.
- Administrators can pin discussions, edit any discussion and its category, delete discussions and comments, verify or suspend members, manage categories, and change gym settings. Category deletion moves discussions to a selected replacement.
- Polish and English interface; responsive navigation and keyboard-accessible dialogs.

## Repository

```text
Frontend/                 React, Vite, Tailwind, HTTP repositories and frontend tests
Backend/                  .NET 10 API, EF Core/PostgreSQL, migrations, API integration tests
Backend/docker/           Database role initialization
Backend/tests/            HTTP integration tests against a disposable PostgreSQL database
docs/                     Architecture, API, security, development and deployment guidance
docker-compose.yml        Local stack built from source
docker-compose-production.yml  Deployment stack using replaceable image references
LiftTogether.sln          API and test solution
```

## Start the local Docker stack

Requires Docker with Linux containers. Copy `.env.example` to `.env` and replace the database and initial administrator passwords. Administrator passwords require 12–128 characters. The bootstrap administrator is created only when no administrator exists; changing the environment variable does not reset an existing account.

```sh
cp .env.example .env
docker compose up --build -d
```

Open **http://localhost:8443** and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Register member accounts through the application, then verify them in the admin panel. There are no public demo credentials or seeded member profiles. If port 8443 is already in use, set `FRONTEND_PORT=8444` in `.env`.

The database binds to `127.0.0.1:5433`; the API binds to `127.0.0.1:8080` (change `API_PORT` if occupied). Adminer is optional and bound to localhost:

```sh
docker compose --profile tools up -d adminer
```

Open http://localhost:8081, choose PostgreSQL, server `postgres`, database `lift`, and use the configured database credentials. The `migrate` service applies versioned migrations and initializes settings, categories, and the first administrator before the API starts. PostgreSQL and Data Protection keys use named volumes. `docker compose down` preserves them; adding `-v` deletes stored data.

## Run from source

Requires Node 24+, .NET SDK 10, and PostgreSQL. See [development instructions](docs/development.md) for database initialization and configuration.

```sh
npm ci --prefix Frontend
npm run dev --prefix Frontend
```

Vite proxies `/api` to `http://127.0.0.1:8080`; `API_PROXY_TARGET` can override that target. The browser always uses same-origin `/api` requests. No secrets belong in frontend environment variables.

```sh
dotnet run --project Backend -- --migrate
dotnet run --project Backend
```

Set `ConnectionStrings__Database`, `Bootstrap__AdminEmail`, and `Bootstrap__AdminPassword` before initialization. Use `ASPNETCORE_ENVIRONMENT=Development` for local HTTP; deployed sessions require HTTPS.

## Validation

```sh
npm test --prefix Frontend
npm run build --prefix Frontend
dotnet build LiftTogether.sln -c Release
dotnet test Backend/tests --filter Rules
```

The full API integration suite needs disposable PostgreSQL connection strings and deletes/recreates only a database whose name ends in `_tests`. It exercises authorization, CSRF, persistence, stale versions, image validation, draft visibility, category moves, and simultaneous requests for the final booking place. See [testing](docs/development.md#tests).

## Production

`docker-compose-production.yml` contains placeholder images:

- `ghcr.io/your-org/lift-together-api:replace-me`
- `ghcr.io/your-org/lift-together-frontend:replace-me`

Replace them or set `API_IMAGE` and `FRONTEND_IMAGE` to your published tags/digests. Prepare the ignored `secrets/` files, configure `ADMIN_EMAIL` and `APP_HOST`, and put the localhost-bound frontend behind an HTTPS reverse proxy that sets `X-Forwarded-Proto: https`. The API and PostgreSQL have no public production ports; Adminer runs only with the `tools` profile. See [deployment](docs/deployment.md) for exact commands, backups, migrations, and TLS configuration.

Security controls include opaque revocable HttpOnly sessions, CSRF validation for mutations, server-side role/ownership checks, bounded input, HTML sanitization, image decoding/re-encoding, rate limits, optimistic concurrency, and a restricted runtime database role. These are implemented controls, not a claim of OWASP certification. See [security](docs/security.md) for the OWASP mapping and operational responsibilities.

Email recovery and account deletion are not exposed: recovery needs a configured delivery/identity service and a verified process. Signed-in users can change passwords; operators can recover the initial administrator using the procedure in [operations](docs/deployment.md#administrator-recovery). Images are normalized to JPEG, so animation and original metadata are intentionally removed.

## Documentation

- [Architecture](docs/architecture.md)
- [API contract](docs/api.md)
- [Development and tests](docs/development.md)
- [Security and performance](docs/security.md)
- [Deployment and operations](docs/deployment.md)
