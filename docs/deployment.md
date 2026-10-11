# Deployment and operations

## Development Compose

Copy `.env.example` to `.env`, replace passwords, and run `docker compose up --build -d`. Source builds produce `lift-together-api:local` and `lift-together-frontend:local`. Services: PostgreSQL, one-shot migrator, API, frontend/Nginx, and optional Adminer. `docker compose --profile tools up -d adminer` exposes Adminer only at 127.0.0.1:8081.

The development database initialization creates `lifttogether_app` and `liftapp`. The owner role owns schema migrations; production uses `liftowner` instead. `liftapp` receives DML and sequence permissions but cannot own schema or change/delete audit history. Init scripts run only when the PostgreSQL volume is empty. Changing environment passwords later is not a rotation mechanism.

## Portainer production stack

Copy the entire `docker-compose-production.yml` into **Portainer → Stacks → Add stack → Web editor** on a **Docker Standalone** environment. No repository checkout, bind mounts, env files or secret files are needed.

Before clicking **Deploy the stack**, replace all occurrences of `CHANGE_ME_OWNER_PASSWORD` with one password, all occurrences of `CHANGE_ME_APP_PASSWORD` with a different password, and `CHANGE_ME_ADMIN_PASSWORD` with a 12-128 character admin password. Use random hex database passwords (for example `openssl rand -hex 32`) to avoid YAML, connection-string and Compose interpolation issues. Set `Bootstrap__AdminEmail` and `AllowedHosts` to your admin email and public hostname (no scheme or port).

The stack uses your published `lewan24/lifttogether-api:latest` and `lewan24/lifttogether-web:latest` images, matching `buildAndPushDockerHub.bat`, plus `postgres:18-alpine`. For repeatable releases, replace all three application image references with matching published release tags. The frontend image must use the default HTTP API mode.

PostgreSQL starts first, then a small one-shot `db-init` job creates the restricted API database user, then `migrate` applies migrations and creates the initial admin. API and frontend start after those jobs succeed. The two setup jobs normally show as exited with status 0. Database data and API encryption keys persist in Docker volumes.

Only frontend is published, at `127.0.0.1:8443`. Configure an HTTPS reverse proxy **on the Docker host** as described below. Production cookies require HTTPS; this is not an HTTP-only stack. API and database stay private. A reverse proxy in another container needs a different network/proxy configuration.

Stack credentials are visible to Portainer/Docker administrators; keep access private and do not commit a filled-in YAML. Changing database passwords in the stack does not rotate existing database roles; update the roles separately. Existing admin accounts are not changed on redeployment. Swarm stacks are not supported by this file because startup relies on Compose dependency conditions.

You can also save the YAML on a host and run `docker compose -f docker-compose-production.yml up -d` without an env file.

## HTTPS edge

Use a trusted HTTPS reverse proxy on the host or adapt the stack to your ingress platform. The edge must overwrite, rather than trust, external `X-Forwarded-Proto` and `X-Forwarded-For`. Example Nginx location inside your TLS virtual host:

```nginx
location / {
    proxy_pass http://127.0.0.1:8443;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}
add_header Strict-Transport-Security "max-age=31536000" always;
```

Configure your certificates and redirect HTTP to HTTPS. The frontend forwards the edge's HTTPS scheme to the API; production cookies are Secure. Only the documented localhost edge may connect to that port. Nginx accepts the edge's client-IP header only from the production Docker gateway, `172.30.24.1`, before forwarding the client address to API rate limits. Compose networks use 172.30.23.0/24 (development) and 172.30.24.0/24 (production); if changing them, update `Proxy__TrustedNetworks__0` and Nginx's `set_real_ip_from` accordingly. Do not set trust to all networks.

## Updates and migrations

Back up the database before upgrades. Review generated migrations and lock impact. For a controlled upgrade, stop the API/frontend first when a migration is incompatible, run the new migration job, then start the new images. For example:

```sh
docker compose -f docker-compose-production.yml stop frontend api
docker compose -f docker-compose-production.yml run --rm migrate
docker compose -f docker-compose-production.yml up -d api frontend
```

Use the same API image for migrator/runtime. Production runtime does not migrate automatically. A failed migration prevents startup; inspect logs without disclosing secrets. Existing bootstrap administrators are not changed during upgrades. Do not run two incompatible schema versions concurrently. Rollback of destructive schema changes requires a verified backup; rolling back only the application image is not sufficient.

## Backups

PostgreSQL volume contains accounts, hashes, sessions, bookings, posts, categories, replies, images and audit events. Back up the Data Protection key volume too. Example PostgreSQL logical dump:

```sh
docker compose -f docker-compose-production.yml exec -T postgres pg_dump -U liftowner -d lift -Fc > lift.dump
```

Protect/encrypt dumps and validate restore in a separate environment. Database role passwords and initialization SQL must be restored/managed separately when restoring onto a new cluster. Backups should have retention, access controls, and restore drills. `docker compose down` retains named volumes; `down -v` permanently removes them.

## Administrator recovery

A signed-in account changes its password in Profile. If an administrator loses access, an operator with migration/owner credentials can use the API image's `--reset-admin` maintenance command. Set `Bootstrap__AdminEmail` and `Bootstrap__AdminPassword` in the migration service to an existing administrator email and the new 12-128 character password, then run:

```sh
docker compose -f docker-compose-production.yml run --rm migrate --reset-admin
```

This requires privileged operator access, does not expose a reset endpoint to users, revokes every previous session for that administrator, and records an audit event. Protect the bootstrap password after use; changing an environment variable alone does not change a stored password.

## Monitoring

`/health/live` checks the running process; `/health/ready` checks that the database responds and seeded settings are available. API Docker healthcheck uses readiness. Frontend `/health` checks Nginx. Logs and error trace IDs support diagnosis without exposing request bodies. Observe CPU during authentication, upload decode memory, HTTP 429/5xx rates, connection pool pressure, PostgreSQL storage and audit growth. Authentication limits: 10 attempts per minute per IP; general API: 180 requests per minute per member/IP; upload: 12 per minute and 48 per day per member. Limits are per API instance except the database-backed daily quota.
