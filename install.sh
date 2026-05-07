#!/usr/bin/env bash
# =====================================================================
# 3X-UI Sub Manager — установка как у самого 3x-ui:
#   1 бинарник Deno + 1 файл SQLite + Caddy (TLS из коробки).
# Зависимости: только curl, tar. БЕЗ docker / postgres / nginx / node.
# Поддержка: Ubuntu 22.04 / 24.04 / Debian 12. RAM от 256 МБ.
#
# Использование:
#   sudo bash install.sh                 # интерактивно
#   sudo REBUILD=1 bash install.sh       # только пересобрать фронт
# =====================================================================
set -euo pipefail

G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'
log(){ echo "${G}[+]${N} $*"; }
warn(){ echo "${Y}[!]${N} $*"; }
die(){ echo "${R}[x]${N} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Запусти от root: sudo bash install.sh"
[[ -f package.json ]] || die "Запускай из корня проекта"

APP_DIR=/opt/sub-manager
DB_DIR=$APP_DIR/data
PORT=8080

# ---- 1. Базовые пакеты ------------------------------------------------
log "Ставим curl, tar, unzip, ca-certificates, debian-keyring"
apt-get update -qq
apt-get install -y -qq curl tar unzip ca-certificates debian-keyring debian-archive-keyring apt-transport-https

# ---- 2. Deno ----------------------------------------------------------
if ! command -v deno >/dev/null 2>&1; then
  log "Ставим Deno"
  curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- -y >/dev/null
fi
deno --version | head -1

# ---- 3. Bun (для сборки фронта; легче ставить чем npm) ----------------
if ! command -v bun >/dev/null 2>&1; then
  log "Ставим Bun (для сборки фронта)"
  curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash >/dev/null
  export PATH=/usr/local/bin:$PATH
fi

# ---- 4. Caddy ---------------------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
  log "Ставим Caddy (HTTPS из коробки)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy
fi

# ---- 5. Параметры -----------------------------------------------------
DOMAIN=${DOMAIN:-}
if [[ -z "${DOMAIN}" && -z "${REBUILD:-}" ]]; then
  read -rp "Домен (пусто = только по IP, без HTTPS): " DOMAIN
fi

PUBLIC_HOST=${DOMAIN:-$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')}
SCHEME=https; [[ -z "$DOMAIN" ]] && SCHEME=http
PUBLIC_URL="$SCHEME://$PUBLIC_HOST"

# ---- 5b. Учётка для входа в панель (basic-auth через Caddy) -----------
AUTH_USER=${AUTH_USER:-}
AUTH_PASS=${AUTH_PASS:-}
if [[ -z "${REBUILD:-}" ]]; then
  [[ -z "$AUTH_USER" ]] && read -rp  "Логин для входа в панель [admin]: " AUTH_USER
  [[ -z "$AUTH_PASS" ]] && read -rsp "Пароль для входа в панель: " AUTH_PASS && echo
fi
AUTH_USER=${AUTH_USER:-admin}
if [[ -z "$AUTH_PASS" ]]; then
  AUTH_PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16)
  warn "Пароль не задан — сгенерирован случайный: $AUTH_PASS"
fi

# ---- 6. Файлы приложения ---------------------------------------------
log "Копируем приложение в $APP_DIR"
mkdir -p "$APP_DIR" "$DB_DIR"
rsync -a --delete --exclude node_modules --exclude .git --exclude data \
  ./ "$APP_DIR/"
cd "$APP_DIR"

# ---- 7. Сборка фронта -------------------------------------------------
log "Собираем фронтенд"
cat > .env <<EOF
VITE_SUPABASE_URL=$PUBLIC_URL
VITE_SUPABASE_PUBLISHABLE_KEY=local-anon-key
VITE_SUPABASE_PROJECT_ID=local
VITE_SUB_BASE_URL=$PUBLIC_URL/sub
EOF
bun install --silent
bun run build

# ---- 8. systemd сервис ------------------------------------------------
log "Регистрируем systemd-сервис sub-manager"
cat >/etc/systemd/system/sub-manager.service <<EOF
[Unit]
Description=3X-UI Sub Manager
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=PORT=$PORT
Environment=STATIC_DIR=$APP_DIR/dist
Environment=DB_PATH=$DB_DIR/app.db
ExecStart=/usr/local/bin/deno run -A --unstable-kv server/main.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now sub-manager

# ---- 9. Caddy ---------------------------------------------------------
log "Настраиваем Caddy"
AUTH_HASH=$(caddy hash-password --plaintext "$AUTH_PASS")
if [[ -n "$DOMAIN" ]]; then
  cat >/etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode gzip
  basicauth /* {
    $AUTH_USER $AUTH_HASH
  }
  reverse_proxy 127.0.0.1:$PORT
}
EOF
else
  cat >/etc/caddy/Caddyfile <<EOF
:80 {
  encode gzip
  basicauth /* {
    $AUTH_USER $AUTH_HASH
  }
  reverse_proxy 127.0.0.1:$PORT
}
EOF
fi
systemctl restart caddy

log "Готово."
echo
echo "  Панель:        $PUBLIC_URL"
echo "  Логин:         $AUTH_USER"
echo "  Пароль:        $AUTH_PASS"
echo "  Подписки:      $PUBLIC_URL/sub/<slug>"
echo "  БД (SQLite):   $DB_DIR/app.db"
echo "  Логи:          journalctl -u sub-manager -f"
echo "  Перезапуск:    systemctl restart sub-manager"
echo
echo "  Пересобрать фронт:  sudo REBUILD=1 bash install.sh"