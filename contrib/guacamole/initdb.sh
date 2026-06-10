#!/usr/bin/env bash
# Initialize Guacamole PostgreSQL schema (idempotent — skips when tables exist).
set -euo pipefail

CONTAINER="${GUAC_POSTGRES_CONTAINER:-machina-guac-postgres}"
DB="${POSTGRES_DB:-guacamole_db}"
USER="${POSTGRES_USER:-guacamole_user}"
GUAC_IMAGE="${GUACAMOLE_IMAGE:-guacamole/guacamole:1.6.0}"

if docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_name='guacamole_entity' LIMIT 1" 2>/dev/null | grep -q 1; then
    echo "Guacamole schema already present in $DB"
    exit 0
fi

echo "Applying Guacamole PostgreSQL schema to $DB ..."
docker run --rm "$GUAC_IMAGE" /opt/guacamole/bin/initdb.sh --postgresql \
    | docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -f -
echo "Guacamole schema initialized"
