#!/usr/bin/env bash
# Rebuild images from the current code and restart every client on the new version.
# Data lives in volumes, so it is kept; migrations run when each API starts.
set -euo pipefail
cd "$(dirname "$0")"

./build-images.sh

while read -r id _; do
  [[ -z "${id:-}" || "$id" == \#* ]] && continue
  echo "Updating $id..."
  docker compose -p "bomify_$id" -f client.compose.yml --env-file "clients/$id/.env" up -d
done < clients.list

./sync-edge.sh
