#!/usr/bin/env bash
# Build the API and web images once; every client stack reuses them.
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -t bomify-api:latest -f apps/api/Dockerfile.prod apps/api
docker build -t bomify-web:latest -f apps/web/Dockerfile.prod apps/web
