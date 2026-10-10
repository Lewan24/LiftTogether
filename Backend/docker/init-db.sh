#!/bin/sh
set -eu
if [ -n "${APP_DB_PASSWORD_FILE:-}" ]; then APP_DB_PASSWORD="$(cat "$APP_DB_PASSWORD_FILE")"; fi
: "${APP_DB_PASSWORD:?Set the runtime database password}"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE liftapp LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE lift TO liftapp;
GRANT USAGE ON SCHEMA public TO liftapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO liftapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO liftapp;
SQL
