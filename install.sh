#!/usr/bin/env bash
# =====================================================================
#  Auto-installer для VPN-панели — ВСЁ на твоём VPS
#  Поддержка: Ubuntu 22.04 / 24.04 (минимум 2 GB RAM, рекомендую 4 GB)
#
#  Что делает скрипт:
#   1. Ставит Node.js 20, Docker, nginx, certbot, apache2-utils, supabase CLI
#   2. Поднимает self-hosted Supabase в Docker (Postgres + API + Auth +
#      Storage + Edge Runtime) в /opt/supabase. БД — у тебя на VPS.
#   3. Генерит JWT ключи (anon, service_role) и пароль БД сам.
#   4. Накатывает схему (supabase/migrations/*) в локальный Postgres.
#   5. Деплоит edge-функции (sub, panel) в локальный Edge Runtime.
#   6. Пишет .env, собирает фронтенд, кладёт в /var/www/panel.
#   7. Настраивает nginx + Basic Auth + проксирование /sub/ → локальный
#      Supabase Kong (порт 8000). Внешних сервисов НЕТ.
#   8. (Опц.) выпускает Let's Encrypt сертификат.
#
#  Использование:
#     sudo bash install.sh                # интерактивно
#     sudo SKIP_SUPABASE=1 bash install.sh  # только пересобрать фронт
# =====================================================================
set -euo pipefail

RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; CLR=$'\e[0m'
log()  { echo "${GRN}[+]${CLR} $*"; }
warn() { echo "${YLW}[!]${CLR} $*"; }
die()  { echo "${RED}[x]${CLR} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Запусти от root: sudo bash install.sh"
[[ -f package.json ]] || die "Нет package.json — запускай скрипт из корня проекта"

SKIP_SUPABASE="${SKIP_SUPABASE:-0}"
SUPA_DIR="/opt/supabase"

# ---------- интерактивный ввод ----------
read -rp "Логин администратора: " ADMIN_USER
[[ -n "$ADMIN_USER" ]] || die "Логин не может быть пустым"

while :; do
  read -rsp "Пароль администратора (мин. 8 символов): " ADMIN_PASS;  echo
  read -rsp "Повтори пароль:                          " ADMIN_PASS2; echo
  [[ "$ADMIN_PASS" == "$ADMIN_PASS2" ]] || { warn "Пароли не совпадают"; continue; }
  [[ ${#ADMIN_PASS} -ge 8 ]] || { warn "Слишком короткий"; continue; }
  break
done

read -rp "Домен (например panel.example.com) или ENTER чтобы пропустить: " DOMAIN
ISSUE_SSL="no"
if [[ -n "$DOMAIN" ]]; then
  read -rp "Email для Let's Encrypt (или ENTER чтобы пропустить SSL): " LE_EMAIL
  [[ -n "$LE_EMAIL" ]] && ISSUE_SSL="yes"
fi

# ---------- Доступы к 3X-UI панелям и Telegram ----------
if [[ "$SKIP_SUPABASE" != "1" ]]; then
  echo
  echo "${GRN}--- Доступы к 3X-UI панелям (для edge-функций) ---${CLR}"
  echo "Можно нажать ENTER чтобы пропустить и заполнить позже в ${SUPA_DIR}/.env"
  read -rp  "PANEL_RU_URL      : " PANEL_RU_URL || true
  read -rp  "PANEL_RU_USERNAME : " PANEL_RU_USERNAME || true
  read -rsp "PANEL_RU_PASSWORD : " PANEL_RU_PASSWORD || true; echo
  read -rp  "PANEL_CZ_URL      : " PANEL_CZ_URL || true
  read -rp  "PANEL_CZ_USERNAME : " PANEL_CZ_USERNAME || true
  read -rsp "PANEL_CZ_PASSWORD : " PANEL_CZ_PASSWORD || true; echo
  read -rp  "TELEGRAM_BOT_TOKEN (опц.): " TELEGRAM_BOT_TOKEN || true
  read -rp  "ADMIN_TELEGRAM_ID  (опц.): " ADMIN_TELEGRAM_ID || true
fi

SERVER_NAME="${DOMAIN:-_}"
WEB_ROOT="/var/www/panel"
HTPASSWD="/etc/nginx/.panel_htpasswd"
NGINX_CONF="/etc/nginx/sites-available/panel.conf"

# ---------- системные пакеты ----------
log "apt update + базовые пакеты…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git nginx apache2-utils ufw postgresql-client jq

if ! command -v node >/dev/null || [[ "$(node -v 2>/dev/null | cut -dv -f2 | cut -d. -f1)" -lt 20 ]]; then
  log "Ставлю Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
log "node $(node -v), npm $(npm -v)"

if [[ "$SKIP_SUPABASE" != "1" ]]; then
  # ---------- Docker ----------
  if ! command -v docker >/dev/null; then
    log "Ставлю Docker…"
    curl -fsSL https://get.docker.com | sh
  fi
  if ! docker compose version >/dev/null 2>&1; then
    apt-get install -y docker-compose-plugin
  fi
  systemctl enable --now docker

  # ---------- self-hosted Supabase ----------
  if [[ ! -d "$SUPA_DIR/docker" ]]; then
    log "Клонирую supabase/supabase в ${SUPA_DIR}…"
    mkdir -p /opt
    git clone --depth 1 https://github.com/supabase/supabase.git "$SUPA_DIR"
  else
    log "Supabase уже в ${SUPA_DIR}, обновляю…"
    git -C "$SUPA_DIR" pull --ff-only || warn "git pull supabase не удался — продолжаю с тем, что есть"
  fi

  cd "$SUPA_DIR/docker"

  # ---------- генерим секреты, если .env ещё нет ----------
  if [[ ! -f .env ]]; then
    log "Генерю JWT ключи и пароли…"
    cp .env.example .env

    JWT_SECRET=$(openssl rand -hex 32)
    POSTGRES_PASSWORD=$(openssl rand -hex 24)
    DASHBOARD_PASSWORD=$(openssl rand -hex 16)

    # генерим anon и service_role JWT через node (HS256)
    NOW=$(date +%s)
    EXP=$((NOW + 60*60*24*365*10)) # 10 лет
    gen_jwt() {
      local role="$1"
      node -e "
        const c=require('crypto');
        const b64=s=>Buffer.from(s).toString('base64url');
        const h=b64(JSON.stringify({alg:'HS256',typ:'JWT'}));
        const p=b64(JSON.stringify({role:'$role',iss:'supabase',iat:$NOW,exp:$EXP}));
        const s=c.createHmac('sha256','$JWT_SECRET').update(h+'.'+p).digest('base64url');
        process.stdout.write(h+'.'+p+'.'+s);
      "
    }
    ANON_KEY=$(gen_jwt anon)
    SERVICE_KEY=$(gen_jwt service_role)

    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
    sed -i "s|^ANON_KEY=.*|ANON_KEY=${ANON_KEY}|" .env
    sed -i "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_KEY}|" .env
    sed -i "s|^DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=${ADMIN_USER}|" .env
    sed -i "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}|" .env
    # внешний URL для kong
    if [[ -n "$DOMAIN" ]]; then
      EXT_URL="https://${DOMAIN}"
    else
      EXT_URL="http://$(curl -s https://api.ipify.org || echo localhost)"
    fi
    sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=${EXT_URL}|" .env
    sed -i "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=${EXT_URL}|" .env
    sed -i "s|^SITE_URL=.*|SITE_URL=${EXT_URL}|" .env

    # секреты edge-функций (panel/sub читают их через Deno.env)
    cat >> .env <<EOF

# === User-provided panel/telegram secrets ===
PANEL_RU_URL=${PANEL_RU_URL:-}
PANEL_RU_USERNAME=${PANEL_RU_USERNAME:-}
PANEL_RU_PASSWORD=${PANEL_RU_PASSWORD:-}
PANEL_CZ_URL=${PANEL_CZ_URL:-}
PANEL_CZ_USERNAME=${PANEL_CZ_USERNAME:-}
PANEL_CZ_PASSWORD=${PANEL_CZ_PASSWORD:-}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
ADMIN_TELEGRAM_ID=${ADMIN_TELEGRAM_ID:-}
EOF

    log "Сгенерированы ключи. Сохрани их (есть в ${SUPA_DIR}/docker/.env):"
    echo "  ANON_KEY     = ${ANON_KEY}"
    echo "  SERVICE_KEY  = ${SERVICE_KEY}"
    echo "  DB password  = ${POSTGRES_PASSWORD}"
    echo "  Dashboard PW = ${DASHBOARD_PASSWORD}"
  else
    log "${SUPA_DIR}/docker/.env уже существует — использую его"
    # подгружаем уже существующие ключи
    set -a; source .env; set +a
    ANON_KEY="${ANON_KEY:-}"
    SERVICE_KEY="${SERVICE_ROLE_KEY:-}"
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
  fi

  # ---------- кладём наши edge-функции в supabase/docker/volumes/functions/ ----------
  log "Копирую edge-функции (sub, panel) в Supabase volumes…"
  PROJECT_DIR="$OLDPWD"
  mkdir -p volumes/functions/sub volumes/functions/panel
  cp -f "$PROJECT_DIR/supabase/functions/sub/index.ts"   volumes/functions/sub/index.ts
  cp -f "$PROJECT_DIR/supabase/functions/panel/index.ts" volumes/functions/panel/index.ts

  # ---------- стартуем стек ----------
  log "Поднимаю Supabase (docker compose up -d)…"
  docker compose pull
  docker compose up -d

  log "Жду готовности Postgres…"
  for i in $(seq 1 60); do
    docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 2
    [[ $i -eq 60 ]] && die "Postgres не стартанул за 2 минуты"
  done

  # ---------- накатываем миграции ----------
  log "Накатываю миграции в локальный Postgres…"
  for f in "$PROJECT_DIR"/supabase/migrations/*.sql; do
    log "  → $(basename "$f")"
    docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=0 -q < "$f" \
      2> >(grep -vE "already exists|does not exist, skipping" >&2) || \
      warn "Миграция $(basename "$f") отработала с предупреждениями"
  done

  # ---------- перезапускаем edge runtime, чтобы подхватил функции ----------
  log "Перезапуск edge runtime…"
  docker compose restart functions

  cd "$PROJECT_DIR"

  # ---------- пишем .env проекта ----------
  # Фронт ходит на тот же домен/IP — nginx проксирует /rest /auth /functions /storage /realtime в Supabase
  if [[ -n "$DOMAIN" ]]; then
    SUPABASE_URL_VAL="$( [[ $ISSUE_SSL == yes ]] && echo https || echo http )://${DOMAIN}"
  else
    SUPABASE_URL_VAL="http://$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')"
  fi
  log "Пишу .env проекта…"
  cat > .env <<ENV
VITE_SUPABASE_URL=${SUPABASE_URL_VAL}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
ENV
else
  log "SKIP_SUPABASE=1 — пропускаю backend, только пересобираю фронт"
  [[ -f .env ]] || die "Нет .env, а SKIP_SUPABASE=1. Запусти без SKIP_SUPABASE."
  SUPABASE_URL_VAL=$(grep -E '^VITE_SUPABASE_URL=' .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
fi

# ---------- сборка ----------
log "npm ci…"
if ! npm ci --no-audit --no-fund; then
  warn "npm ci не прошёл (lock рассинхронизирован) — переключаюсь на npm install"
  npm install --no-audit --no-fund
fi
log "npm run build…"
npm run build
[[ -d dist ]] || die "Сборка не создала dist/"

# ---------- деплой статики ----------
log "Копирую билд в ${WEB_ROOT}…"
mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"*
cp -r dist/* "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"

# ---------- htpasswd ----------
log "Создаю htpasswd для админа…"
htpasswd -bc "$HTPASSWD" "$ADMIN_USER" "$ADMIN_PASS" >/dev/null
chown root:www-data "$HTPASSWD"
chmod 640 "$HTPASSWD"

# ---------- nginx ----------
log "Пишу nginx-конфиг…"
cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAME};

    root ${WEB_ROOT};
    index index.html;

    # лимиты и базовая защита
    client_max_body_size 10m;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Basic Auth — единая защита всей панели
    auth_basic "Restricted — Admin only";
    auth_basic_user_file ${HTPASSWD};

    # Подписка: /sub/<slug> -> твой Supabase edge function (БЕЗ Basic Auth)
    location /sub/ {
        auth_basic off;
        proxy_pass http://127.0.0.1:8000/functions/v1/sub/;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Локальный Supabase API (REST + Auth + Edge) — без Basic Auth, нужен фронту
    location /rest/         { auth_basic off; proxy_pass http://127.0.0.1:8000; proxy_set_header Host \$host; }
    location /auth/         { auth_basic off; proxy_pass http://127.0.0.1:8000; proxy_set_header Host \$host; }
    location /realtime/     { auth_basic off; proxy_pass http://127.0.0.1:8000; proxy_set_header Host \$host;
        proxy_http_version 1.1; proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection "upgrade"; }
    location /storage/      { auth_basic off; proxy_pass http://127.0.0.1:8000; proxy_set_header Host \$host; client_max_body_size 50m; }
    location /functions/    { auth_basic off; proxy_pass http://127.0.0.1:8000; proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # SPA fallback (React Router)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # статика — длинный кэш
    location /assets/ {
        expires 30d;
        access_log off;
        try_files \$uri =404;
    }
}
NGINX

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/panel.conf
rm -f /etc/nginx/sites-enabled/default

log "nginx -t…"
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx

# ---------- firewall ----------
if command -v ufw >/dev/null; then
  log "Открываю порты 22/80/443 в ufw…"
  ufw allow 22/tcp  >/dev/null || true
  ufw allow 80/tcp  >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
  yes | ufw enable >/dev/null 2>&1 || true
fi

# ---------- SSL ----------
if [[ "$ISSUE_SSL" == "yes" ]]; then
  log "Ставлю certbot и выпускаю сертификат для ${DOMAIN}…"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -n --agree-tos -m "$LE_EMAIL" -d "$DOMAIN" --redirect || \
    warn "certbot не смог выпустить сертификат — проверь DNS A-запись на этот сервер"
fi

IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')
URL="http://${DOMAIN:-$IP}"
[[ "$ISSUE_SSL" == "yes" ]] && URL="https://${DOMAIN}"

echo
echo "${GRN}========================================================${CLR}"
echo "${GRN}  Готово!${CLR}"
echo "  URL:    ${URL}"
echo "  Логин:  ${ADMIN_USER}"
echo "  Пароль: (введённый при установке)"
echo
echo "  Сменить пароль:    sudo htpasswd ${HTPASSWD} ${ADMIN_USER}"
echo "  Добавить юзера:    sudo htpasswd ${HTPASSWD} <login>"
echo "  Перевыкатить:      sudo bash install.sh  (в этой же папке)"
echo "${GRN}========================================================${CLR}"