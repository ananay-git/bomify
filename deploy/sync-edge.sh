#!/usr/bin/env bash
# Regenerate the shared Caddy (public entry point) from clients.list and apply it.
#
# clients.list format, one client per line:   <id> <port> <domain-or->
#   acme 8101 -                  -> served at http://<server-ip>:8101
#   acme 8101 acme.example.com   -> served at https://acme.example.com (auto HTTPS)
set -euo pipefail
cd "$(dirname "$0")"

LIST=clients.list
touch "$LIST"
mkdir -p edge/conf
docker network inspect edge >/dev/null 2>&1 || docker network create edge >/dev/null

ports=""
need_web_ports=0
: > edge/conf/Caddyfile

while read -r id port domain _; do
  [[ -z "${id:-}" || "$id" == \#* ]] && continue
  if [[ -n "${domain:-}" && "$domain" != "-" ]]; then
    addr="$domain"
    need_web_ports=1
  else
    addr=":$port"
    ports+="      - \"$port:$port\"\n"
  fi
  cat >> edge/conf/Caddyfile <<EOF
$addr {
	encode gzip
	reverse_proxy ${id}-web:80
}

EOF
done < "$LIST"

if [[ $need_web_ports -eq 1 ]]; then
  ports+="      - \"80:80\"\n      - \"443:443\"\n"
fi

{
  echo "services:"
  echo "  caddy:"
  echo "    image: caddy:2-alpine"
  echo "    restart: unless-stopped"
  if [[ -n "$ports" ]]; then
    echo "    ports:"
    printf '%b' "$ports"
  fi
  echo "    volumes:"
  echo "      - ./conf:/etc/caddy:ro"
  echo "      - caddy_data:/data"
  echo "      - caddy_config:/config"
  echo "    networks:"
  echo "      - edge"
  echo ""
  echo "volumes:"
  echo "  caddy_data:"
  echo "  caddy_config:"
  echo ""
  echo "networks:"
  echo "  edge:"
  echo "    external: true"
  echo "    name: edge"
} > edge/docker-compose.yml

docker compose -p bomify_edge -f edge/docker-compose.yml up -d
# Picks up Caddyfile-only changes without dropping connections
docker compose -p bomify_edge -f edge/docker-compose.yml exec -T caddy \
  caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
