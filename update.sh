#!/usr/bin/env bash
# =====================================================================
#  Обновление 3X-UI Sub Manager на VDS.
#  Использование (из корня свежей версии проекта):
#     sudo bash update.sh
#
#  Что делает:
#    1. Синхронизирует файлы в /opt/sub-manager (без data/, .git, node_modules)
#    2. Пересобирает фронт (bun run build)
#    3. Перезапускает systemd-сервис sub-manager
#    4. Перезагружает Caddy если конфиг менялся
# =====================================================================
set -euo pipefail

G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'
log(){  echo "${G}[+]${N} $*"; }
warn(){ echo "${Y}[!]${N} $*"; }
die(){  echo "${R}[x]${N} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Запусти от root: sudo bash update.sh"
[[ -f package.json ]] || die "Запускай из корня проекта"

APP_DIR=/opt/sub-manager
DB_DIR=$APP_DIR/data

command -v deno >/dev/null 2>&1 || die "Deno не установлен — сначала прогоните install.sh"
command -v bun  >/dev/null 2>&1 || die "Bun не установлен — сначала прогоните install.sh"

log "Синхронизирую файлы в $APP_DIR"
mkdir -p "$APP_DIR" "$DB_DIR"
ENV_BACKUP=""
if [[ -f "$APP_DIR/.env" ]]; then
  ENV_BACKUP=$(mktemp)
  cp "$APP_DIR/.env" "$ENV_BACKUP"
fi
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude data --exclude dist --exclude .env \
  ./ "$APP_DIR/"

cd "$APP_DIR"

if [[ -n "$ENV_BACKUP" && -f "$ENV_BACKUP" ]]; then
  cp "$ENV_BACKUP" .env
  rm -f "$ENV_BACKUP"
fi

if [[ ! -f .env ]]; then
  warn ".env не найден — создаю безопасный локальный .env, чтобы фронт не падал чёрным экраном"
  PUBLIC_URL=${PUBLIC_URL:-}
  if [[ -z "$PUBLIC_URL" && -f /etc/caddy/Caddyfile ]]; then
    CADDY_HOST=$(awk '/^[^ \t#].*\{/{print $1; exit}' /etc/caddy/Caddyfile | tr -d '{' || true)
    if [[ -n "$CADDY_HOST" && "$CADDY_HOST" != :* ]]; then PUBLIC_URL="https://$CADDY_HOST"; fi
  fi
  if [[ -z "$PUBLIC_URL" ]]; then
    PUBLIC_HOST=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
    PUBLIC_URL="http://$PUBLIC_HOST"
  fi
  cat > .env <<EOF
VITE_SUPABASE_URL=$PUBLIC_URL
VITE_SUPABASE_PUBLISHABLE_KEY=local-anon-key
VITE_SUPABASE_PROJECT_ID=local
VITE_SUB_BASE_URL=$PUBLIC_URL/sub
EOF
fi

log "bun install"
bun install --silent

log "bun run build"
bun run build
[[ -d dist ]] || die "Сборка не создала dist/"

log "Перезапускаю sub-manager"
systemctl restart sub-manager
sleep 1
systemctl --no-pager --lines=0 status sub-manager || true

echo
echo "${G}[✓] Обновлено${N}"
echo "  Логи:        journalctl -u sub-manager -f"