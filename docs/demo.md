# Browser-only demo and Cloudflare Pages

The frontend has two build-time modes selected with `VITE_API_MODE`:

| Value | Behavior |
| --- | --- |
| `http` | Default locally and in Docker. Calls the same-origin .NET API; PostgreSQL stores application data. |
| `mock` | Static demo. Uses only browser localStorage for application data and the demo session. No .NET API or PostgreSQL is required. |

There is no automatic fallback after an HTTP failure. An invalid mode fails the build. Changing a mode requires rebuilding; production API credentials and session cookies are never copied into demo storage.

## Local demo

```sh
npm ci --prefix Frontend
npm run dev:demo --prefix Frontend
```

Or build static files with `npm run build:demo --prefix Frontend`. Serve `Frontend/dist` over HTTP/HTTPS, rather than opening `index.html` as a local file.

The login screen has buttons to fill the demo administrator and verified member accounts:

- Administrator: `admin@demo.example`
- Member: `member@demo.example`
- Password for both: `Demo-password-2026!`

Accounts, registration/verification, profile changes, bookings, news, comments, forum discussions, categories and JPEG image attachments work locally. Demo changes persist across reloads. The banner's **Reset demo** button removes only the demo storage key and restores sample data. Images are resized and re-encoded before storage; browser storage quota limits their total size. No application data is shared with other visitors or devices. The demo's local role checks simulate UX; they are not real authentication or access control. Use fictional personal details and passwords.

## Cloudflare Pages from GitHub

Connect the GitHub repository to Cloudflare Pages and configure:

| Setting | Value |
| --- | --- |
| Root directory | `Frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `VITE_API_MODE=mock` |
| Node version | `24` (also supplied by `Frontend/.node-version`) |

Set the variable for production and preview builds. Cloudflare Pages supplies `CF_PAGES=1`, which selects mock mode automatically when `VITE_API_MODE` is unset. Setting the mode explicitly is recommended so deployment intent is visible. Git integration rebuilds the static frontend after pushes. `Frontend/public/_headers` supplies security headers and immutable asset caching on Pages.

These settings follow the [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [build image](https://developers.cloudflare.com/pages/configuration/build-image/) and [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) documentation.

Cloudflare Pages hosts the static demo. Hosting the HTTP application also requires deploying the .NET API and PostgreSQL separately and routing `/api` through the same origin. `VITE_API_MODE=http` alone does not deploy either backend service.

## Docker

HTTP mode is the Docker default. To build a demo image explicitly:

```sh
docker build --build-arg VITE_API_MODE=mock -t lift-together-demo ./Frontend
docker run --rm -p 127.0.0.1:8443:8080 lift-together-demo
```

The demo image serves static assets and returns 404 for `/api` without requiring an API upstream. HTTP images retain the same-origin API proxy.

The profile hero and My Stats are also available in demo mode. Training confirmation uses the same ownership, version, cancellation and Warsaw end-time rules, persists `completedAt` only in isolated demo storage, and records `booking.complete` in demo activity. Existing demo bookings default to unconfirmed. HTTP sessions and statistics never use this storage.
