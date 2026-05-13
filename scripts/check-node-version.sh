#!/usr/bin/env bash
set -euo pipefail

nvmrc_version="$(tr -d '[:space:]' < frontend/.nvmrc)"
docker_version="$(sed -n 's/^ARG NODE_VERSION=//p' frontend/Dockerfile | head -n1 | tr -d '[:space:]')"

if [[ -z "$nvmrc_version" ]]; then
  echo "frontend/.nvmrc is empty"
  exit 1
fi

if [[ -z "$docker_version" ]]; then
  echo "frontend/Dockerfile does not declare ARG NODE_VERSION=<version>"
  exit 1
fi

if [[ "$nvmrc_version" != "$docker_version" ]]; then
  echo "Node version mismatch:"
  echo "  frontend/.nvmrc: $nvmrc_version"
  echo "  frontend/Dockerfile ARG NODE_VERSION: $docker_version"
  exit 1
fi

echo "Node version is consistent: $nvmrc_version"
