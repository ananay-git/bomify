#!/usr/bin/env bash
# Create and start a new isolated client stack.
#   ./new-client.sh <id> ["Display Name"]
# <id>: lowercase letters/digits, e.g. acme. Optional: export GROQ_API_KEY=... first.
set -euo pipefail
cd "$(dirname "$0")"

id="${1:-}"
name="${2:-$id}"
if [[ ! "$id" =~ ^[a-z][a-z0-9]{1,19}$ ]]; then
  echo "usage: $0 <id> [\"Display Name\"]   (id: lowercase letters/digits, 2-20 chars)" >&2
  exit 1
fi

touch clients.list
if grep -qE "^$id[[:space:]]" clients.list; then
  echo "Client '$id' already exists." >&2
  exit 1
fi

last=$(awk '!/^#/ && NF {print $2}' clients.list | sort -n | tail -1)
port=$(( ${last:-8100} + 1 ))

rand() { openssl rand -hex "$1"; }
admin_pw=$(rand 8)

mkdir -p "clients/$id"
cat > "clients/$id/.env" <<EOF
CLIENT_ID=$id
CLIENT_NAME=$name
POSTGRES_USER=bomify
POSTGRES_PASSWORD=$(rand 16)
POSTGRES_DB=bomify
SECRET_KEY=$(rand 32)
JWT_SECRET_KEY=$(rand 32)
COPILOT_DB_PASSWORD=$(rand 16)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$admin_pw
ADMIN_EMAIL=admin@$id.local
GROQ_API_KEY=${GROQ_API_KEY:-}
# API_WORKERS=1
EOF
chmod 600 "clients/$id/.env"

if ! docker image inspect bomify-api:latest bomify-web:latest >/dev/null 2>&1; then
  echo "Images not built yet; building (first time only)..."
  ./build-images.sh
fi

docker network inspect edge >/dev/null 2>&1 || docker network create edge >/dev/null
docker compose -p "bomify_$id" -f client.compose.yml --env-file "clients/$id/.env" up -d

echo "$id $port -" >> clients.list
./sync-edge.sh

ip=$(curl -s --max-time 5 https://ifconfig.me || echo "<SERVER_IP>")
echo
echo "Client '$id' is up (the API takes ~30s to finish migrating)."
echo "  URL:      http://$ip:$port"
echo "  Login:    admin / $admin_pw"
echo "  Secrets:  deploy/clients/$id/.env"
