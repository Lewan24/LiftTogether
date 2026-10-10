# Lift Together

React 19 + Vite + Tailwind v4 frontend and .NET 10 minimal API with PostgreSQL.

## Structure

- `Frontend/src/App.tsx`: application coordination and async HTTP state.
- `Frontend/src/main.tsx` and `Frontend/src/index.css`: entrypoint, fonts, global/Tailwind styling.
- `Frontend/src/pages/`: lazy screens.
- `Frontend/src/services/api.ts`, `http.ts`, `forum.ts`: validated HTTP contracts, cookies, CSRF, domain requests.
- `Frontend/src/services/storage.ts`: types and language preference only; do not reintroduce mock credentials/persistence.
- `Frontend/package.json`, `Frontend/vite.config.ts`: frontend tooling.
- `Backend/Program.cs`: host/security pipeline.
- `Backend/Endpoints/`, `Backend/Security/`, `Backend/Data/`: minimal API modules, validation, EF model and migrations.
- `Backend/tests/`: integration tests; require a disposable PostgreSQL database ending in `_tests`.
- `docs/`: authoritative architecture, API, security and deployment context.

## Development

Use the existing preview/dev server when available; do not start another instance on an occupied port. Vite defaults to 8443 and proxies `/api` to localhost:8080. Commands from root: `npm run dev --prefix Frontend`, `npm run build --prefix Frontend`, `npm test --prefix Frontend`, `dotnet build LiftTogether.sln`. See `docs/development.md` for configuration.

## Rules

Keep frontend authorization as UX only; enforce role, verification and ownership at the API. Never store session tokens or credentials in browser storage. All mutations require CSRF, bounded DTOs and server validation; check optimistic versions for updates. Booking daily capacity must be checked transactionally. Keep raw uploads out of static/executable paths. No secrets in frontend bundles or tracked env files.

Use Tailwind v4 utilities in JSX and global theme customization in `Frontend/src/index.css`. CSS imports come first. Ensure strings, JSX tags and braces are valid. Component default exports are preferred. Do not overwrite unrelated working-tree edits.
