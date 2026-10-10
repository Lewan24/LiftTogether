# Deployment and operations

## Development Compose

Copy `.env.example` to `.env`, replace passwords, and run `docker compose up --build -d`. Source builds produce `lift-together-api:local` and `lift-together-frontend:local`. Services: PostgreSQL, one-shot migrator, API, frontend/Nginx, and optional Adminer. `docker compose --profile tools up -d adminer` exposes Adminer only at 127.0.0.1:8081.

The first database initialization creates `liftowner` and `liftapp`. `liftowner` owns schema migrations; `liftapp` receives DML and sequence permissions but cannot own schema or change/delete audit history. Init scripts run only when the PostgreSQL volume is empty. Changing environment passwords later is not a rotation mechanism.

## Production images and secrets

Build and publish the images to your registry; use immutable tags or digests:

```sh
docker build -t your-registry/lift-api:release ./Backend
docker build -t your-registry/lift-web:release ./Frontend
docker push your-registry/lift-api:release
docker push your-registry/lift-web:release
```

Set `API_IMAGE` and `FRONTEND_IMAGE` to those references. The defaults in `docker-compose-production.yml` are deliberately temporary `ghcr.io/your-org/...:replace-me` names, not available public releases. There are no production build directives.

Prepare ignored `secrets/postgres_password.txt`, `secrets/app_db_password.txt`, and `secrets/admin_password.txt`, each containing only its password. Generate independent random secrets, protect file permissions, and do not commit them. Set `ADMIN_EMAIL` and `APP_HOST` in the production environment or a protected env file. `APP_HOST` must be the public hostname. `FRONTEND_PORT` defaults to 8443.

```sh
docker compose -f docker-compose-production.yml --env-file .env.production config --quiet
docker compose -f docker-compose-production.yml --env-file .env.production pull
docker compose -f docker-compose-production.yml --env-file .env.production up -d
```

The migration job applies schema changes and bootstrap before the API, and frontend waits for API readiness. Production binds frontend to localhost only; API/PostgreSQL have no published ports. Keep Adminer off unless needed, and access it through SSH forwarding. API/frontend run as non-root with read-only filesystems, writable `/tmp`, dropped capabilities and no-new-privileges. API key storage has a persistent writable volume.

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
docker compose -f docker-compose-production.yml --env-file .env.production stop frontend api
docker compose -f docker-compose-production.yml --env-file .env.production run --rm migrate
docker compose -f docker-compose-production.yml --env-file .env.production up -d api frontend
```

Use the same API image for migrator/runtime. Production runtime does not migrate automatically. A failed migration prevents startup; inspect logs without disclosing secrets. Existing bootstrap administrators are not changed during upgrades. Do not run two incompatible schema versions concurrently. Rollback of destructive schema changes requires a verified backup; rolling back only the application image is not sufficient.

## Backups

PostgreSQL volume contains accounts, hashes, sessions, bookings, posts, categories, replies, images and audit events. Back up the Data Protection key volume too. Example PostgreSQL logical dump:

```sh
docker compose -f docker-compose-production.yml exec -T postgres pg_dump -U liftowner -d lift -Fc > lift.dump
```

Protect/encrypt dumps and validate restore in a separate environment. Database role passwords and initialization SQL must be restored/managed separately when restoring onto a new cluster. Backups should have retention, access controls, and restore drills. `docker compose down` retains named volumes; `down -v` permanently removes them.

## Administrator recovery

A signed-in account changes its password in Profile. If an administrator loses access, an operator with migration/owner credentials can use the API image's `--reset-admin` maintenance command. Set `Bootstrap__AdminEmail` to an existing administrator email and `Bootstrap__AdminPasswordFile` to a protected file with the new 12-128 character password (or set the corresponding environment secret for local development), then run:

```sh
docker compose -f docker-compose-production.yml --env-file .env.production run --rm migrate --reset-admin
```

This requires privileged operator access, does not expose a reset endpoint to users, revokes every previous session for that administrator, and records an audit event. Rotate/remove the bootstrap secret after use; changing an environment variable alone does not change a stored password.

## Monitoring

`/health/live` checks the running process; `/health/ready` checks database connectivity. API Docker healthcheck uses readiness. Frontend `/health` checks Nginx. Logs and error trace IDs support diagnosis without exposing request bodies. Observe CPU during authentication, upload decode memory, HTTP 429/5xx rates, connection pool pressure, PostgreSQL storage and audit growth. Authentication limits: 10 attempts per minute per IP; general API: 180 requests per minute per member/IP; upload: 12 per minute and 48 per day per member. Limits are per API instance except the database-backed daily quota.
