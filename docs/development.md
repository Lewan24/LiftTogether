# Development

## Prerequisites and configuration

Use .NET SDK 10, Node 24+, and Docker with Linux containers or PostgreSQL 18. All frontend files live in `Frontend/`; run npm with `--prefix Frontend` or change into that directory. API sources and migrations live in `Backend/`. `.env` is loaded by Docker Compose, not automatically by `dotnet run`.

For local frontend/API development, start the database from the supplied database-only Compose file:

```sh
docker compose -f docker-compose-dbs.yml up -d
```

The database-only stack uses `lifttogether` on port 5432 with user/password `lifttogether_app`. `Backend/appsettings.Development.json` supplies this local-only default; environment variables override it. Adminer uses port 8081 so the API can use 8080. Restart the existing Adminer service with the command above to apply its new port. The full development Compose stack uses the same database/owner defaults and a separate DML runtime role (`liftapp`). Production uses independent secrets and owner/runtime roles. PostgreSQL initialization scripts run only on a fresh volume. Changing environment passwords later does not change existing database-role passwords; rotate them explicitly using PostgreSQL administration.

For local shell development, supply these environment variables (PowerShell uses `$env:NAME = 'value'`):

| Variable                    | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| ConnectionStrings__Database | Optional override; local PostgreSQL defaults to port 5432   |
| Bootstrap__AdminEmail       | Initial administrator email                               |
| Bootstrap__AdminPassword    | Initial administrator password; 12-128 characters         |
| ASPNETCORE_ENVIRONMENT      | `Development` enables localhost HTTP cookies              |
| DataProtection__Path        | Optional persistent key folder; defaults to Backend/.keys |
| API_PROXY_TARGET            | Vite proxy target; defaults to http://127.0.0.1:8080      |
| PORT                        | Vite port; defaults to 8443                               |

Development startup automatically applies migrations and seeds settings/categories (`Database__AutoInitialize=true` by default). When no administrator exists, it creates the local account configured in `Backend/appsettings.Development.json`: `admin@lifttogether.local` / `Local-admin-2026!`. Its password is hashed and the account is already verified. Existing administrators are never overwritten; changing bootstrap settings does not reset their passwords. Environment variables override these local defaults. Production has no default administrator credentials: configure bootstrap values for the explicit `--migrate` command. The database-only stack uses its owner role for local development. With full Compose, migrations use the owner connection and API uses the runtime connection. Do not put real credentials in command-line arguments, frontend `.env` variables, repository files or logs. Checked-in passwords are for local development only.

```sh
# Development startup initializes the schema and settings automatically.
dotnet run --project Backend
npm ci --prefix Frontend
npm run dev --prefix Frontend
```

The database-only and full Compose stacks use separate volumes and both default to port 5432. Stop the database-only stack before starting full Compose, or set `DB_PORT` to a free port for full Compose. Existing volumes are not renamed or reinitialized by configuration changes.

The same-origin Vite proxy preserves session and CSRF cookies. Avoid accessing React and the API through different hostnames. `localhost` and `127.0.0.1` are different cookie origins. Without the API/database, the UI displays an error and retry action; there is no silent demo fallback.

## Migrations

The local EF tool is pinned in `Backend/dotnet-tools.json`:

```sh
cd Backend
dotnet tool restore
dotnet tool run dotnet-ef migrations add MeaningfulChange --output-dir Data/Migrations
dotnet tool run dotnet-ef migrations has-pending-model-changes
```

`DesignTimeFactory` allows generating a migration without running or connecting the application. Apply migrations with `--migrate` or the Compose migration job, with owner credentials. Review SQL for lock duration and data loss; add backwards-compatible migrations before switching images. The production API never applies DDL on startup. Full Compose disables development auto-initialization for the runtime API because its restricted database role must not perform migrations. Use `Database__AutoInitialize=false` with any local runtime-only role.

## Tests

```sh
npm test --prefix Frontend
npm run build --prefix Frontend
npm run format:check --prefix Frontend
dotnet build LiftTogether.sln -c Release
dotnet test Backend/tests --filter Rules
```

For the complete HTTP suite, set `LIFT_TEST_ADMIN_CONNECTION` to an owner connection string for a **disposable database ending in `_tests`**, and `LIFT_TEST_CONNECTION` to a connection for `liftapp` for that same database. The test host replaces the development connection with the supplied runtime test connection; both connection strings must point to the same host, port and `_tests` database. The full Compose database already contains the runtime role (the database-only stack does not); tests grant that role permissions in the newly created test database.

```sh
dotnet test Backend/tests
```

The integration test deliberately deletes/recreates the named `_tests` database and removes it after success. Do not point it at an application database. Tests seed their own isolated administrator and members, use real PostgreSQL transactions, and exercise actual minimal-API requests with cookies and CSRF tokens. A failed test can leave its test database for inspection; the next run recreates it.

Coverage includes role and object authorization, CSRF rejection, three-hour bounds, one daily booking, concurrent capacity checks, profile mass-assignment resistance, rich-text sanitization, pin concurrency, category reassignment, draft privacy, private upload reads, image format rejection, logout revocation and persistence across a new API host. Frontend tests cover booking rules, safe profile links and HTTP boundaries/errors.

## Formatting and dependencies

Frontend uses Prettier (`npm run format --prefix Frontend`). C# can be formatted with `dotnet format LiftTogether.sln --no-restore`. Runtime dependencies are pinned in `Backend/packages.lock.json` and `Frontend/package-lock.json`; Docker uses locked restore and npm ci. Use `npm audit --prefix Frontend` and `dotnet list Backend package --vulnerable --include-transitive` when updating packages. Keep PostgreSQL, .NET and image-codec security patches current.

## Existing source moves

The old root `src/`, `tests/`, package files, Vite configuration and HTML shell were moved to `Frontend/`. Root agent guidance now describes the split layout. Historical `docs/ui-refactor.md` is retained as a record of the earlier UI work; it is not the current API architecture.

For static hosting without an API/database, see [demo mode and Cloudflare Pages](demo.md).

Database initialization also seeds a pinned bilingual gym regulations forum topic, attributed to an administrator. The `bootstrap.regulations` audit marker makes seeding run once, preserves edits, and prevents a deliberately deleted topic from reappearing. Review and edit the starter rules in the admin forum to match your gym.
