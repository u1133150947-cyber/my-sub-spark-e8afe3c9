#!/usr/bin/env bash
# =====================================================================
#  Auto-installer для VPN-панели (Vite + СВОЙ Supabase)
#  Поддержка: Ubuntu 22.04 / 24.04
#
#  Что делает скрипт:
#   1. Ставит Node.js 20, nginx, git, apache2-utils, certbot, supabase CLI
#   2. Спрашивает доступы к ТВОЕМУ Supabase-проекту (URL, anon key,
#      service role key, project ref, db password) и логин/пароль админа
#   3. Накатывает схему (supabase/migrations/*) в твою БД
#   4. Деплоит edge-функции (sub, panel) и записывает их секреты
#   5. Пишет .env с твоими ключами и собирает фронтенд
#   6. Кладёт билд в /var/www/panel
#   7. Настраивает nginx + Basic Auth + проксирование /sub/ на твой Supabase
#   8. (Опц.) выпускает Let's Encrypt сертификат
#
#  Использование:
#     sudo bash install.sh                # интерактивно
#     sudo SKIP_SUPABASE=1 bash install.sh  # только пересобрать фронт
#
#  Перед запуском создай ПУСТОЙ проект на https://supabase.com (Free tier).
#  Из Project Settings возьми: URL, anon key, service_role key, project ref
#  (ref — это поддомен xxxx.supabase.co), Database password.
# =====================================================================
set -euo pipefail

RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; CLR=$'\e[0m'
log()  { echo "${GRN}[+]${CLR} $*"; }
warn() { echo "${YLW}[!]${CLR} $*"; }
die()  { echo "${RED}[x]${CLR} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Запусти от root: sudo bash install.sh"
[[ -f package.json ]] || die "Нет package.json — запускай скрипт из корня проекта"

SKIP_SUPABASE="${SKIP_SUPABASE:-0}"

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

# ---------- Supabase ----------
if [[ "$SKIP_SUPABASE" != "1" ]]; then
  echo
  echo "${GRN}--- Доступы к ТВОЕМУ Supabase-проекту ---${CLR}"
  echo "Создай проект на https://supabase.com (Free tier) и возьми из Project Settings:"
  echo "  • API → URL и anon public key и service_role key"
  echo "  • General → Reference ID (project ref, например abcdefghij)"
  echo "  • Database → пароль БД (тот, что задавал при создании проекта)"
  echo
  read -rp "Supabase URL (https://<ref>.supabase.co): " SUPABASE_URL_VAL
  read -rp "Supabase project ref (xxxx из xxxx.supabase.co): " SUPABASE_REF
  read -rsp "Supabase anon (publishable) key: " SUPABASE_ANON; echo
  read -rsp "Supabase service_role key:       " SUPABASE_SERVICE; echo
  read -rsp "Supabase database password:      " SUPABASE_DB_PASS; echo

  [[ -n "$SUPABASE_URL_VAL" && -n "$SUPABASE_REF" && -n "$SUPABASE_ANON" && -n "$SUPABASE_SERVICE" && -n "$SUPABASE_DB_PASS" ]] \
    || die "Все поля Supabase обязательны"

  echo
  echo "${GRN}--- Доступы к 3X-UI панелям (для edge-функций) ---${CLR}"
  echo "Можно нажать ENTER чтобы пропустить и заполнить позже через Supabase Dashboard → Edge Functions → Secrets."
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

# ---------- Supabase CLI ----------
if [[ "$SKIP_SUPABASE" != "1" ]]; then
  if ! command -v supabase >/dev/null; then
    log "Ставлю Supabase CLI…"
    SUPA_VER="2.20.5"
    ARCH=$(dpkg --print-architecture)
    curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPA_VER}/supabase_${SUPA_VER}_linux_${ARCH}.deb" -o /tmp/supabase.deb
    dpkg -i /tmp/supabase.deb || apt-get -fy install
    rm -f /tmp/supabase.deb
  fi
  log "supabase $(supabase --version)"

  # ---------- пишем .env ----------
  log "Пишу .env с твоими ключами…"
  cat > .env <<ENV
VITE_SUPABASE_URL=${SUPABASE_URL_VAL}
VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON}
VITE_SUPABASE_PROJECT_ID=${SUPABASE_REF}
ENV

  # ---------- подменяем project_id в supabase/config.toml ----------
  log "Обновляю supabase/config.toml → ${SUPABASE_REF}"
  sed -i "s/^project_id = .*/project_id = \"${SUPABASE_REF}\"/" supabase/config.toml

  # ---------- накатываем миграции напрямую через psql (надёжнее, чем supabase db push) ----------
  PG_URI="postgresql://postgres.${SUPABASE_REF}:${SUPABASE_DB_PASS}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
  log "Проверяю подключение к БД…"
  if ! PGPASSWORD="$SUPABASE_DB_PASS" psql "$PG_URI" -c "select 1" >/dev/null 2>&1; then
    warn "Pooler eu-central-1 не отвечает — пробую прямое подключение"
    PG_URI="postgresql://postgres:${SUPABASE_DB_PASS}@db.${SUPABASE_REF}.supabase.co:5432/postgres"
    PGPASSWORD="$SUPABASE_DB_PASS" psql "$PG_URI" -c "select 1" >/dev/null \
      || die "Не удаётся подключиться к БД. Проверь project ref и пароль."
  fi

  log "Накатываю миграции из supabase/migrations/…"
  for f in supabase/migrations/*.sql; do
    log "  → $(basename "$f")"
    PGPASSWORD="$SUPABASE_DB_PASS" psql "$PG_URI" -v ON_ERROR_STOP=0 -q -f "$f" \
      2> >(grep -vE "already exists|does not exist, skipping" >&2) || \
      warn "Миграция $(basename "$f") отработала с предупреждениями (нормально, если БД уже частично накатана)"
  done

  # ---------- логин в supabase CLI и деплой функций ----------
  log "Деплою edge-функции (sub, panel)…"
  export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
  if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
    warn "SUPABASE_ACCESS_TOKEN не задан."
    echo  "  → Сгенерируй access token: https://supabase.com/dashboard/account/tokens"
    read -rsp "Вставь Supabase access token: " SUPABASE_ACCESS_TOKEN; echo
    export SUPABASE_ACCESS_TOKEN
  fi

  supabase link --project-ref "$SUPABASE_REF" --password "$SUPABASE_DB_PASS" >/dev/null 2>&1 || \
    warn "supabase link выдал предупреждения — продолжаю"

  for fn in sub panel; do
    log "  deploy $fn…"
    supabase functions deploy "$fn" --no-verify-jwt --project-ref "$SUPABASE_REF" \
      || die "Не удалось задеплоить функцию $fn"
  done

  # ---------- секреты функций ----------
  log "Записываю секреты edge-функций…"
  SECRET_ARGS=()
  [[ -n "${PANEL_RU_URL:-}"      ]] && SECRET_ARGS+=("PANEL_RU_URL=$PANEL_RU_URL")
  [[ -n "${PANEL_RU_USERNAME:-}" ]] && SECRET_ARGS+=("PANEL_RU_USERNAME=$PANEL_RU_USERNAME")
  [[ -n "${PANEL_RU_PASSWORD:-}" ]] && SECRET_ARGS+=("PANEL_RU_PASSWORD=$PANEL_RU_PASSWORD")
  [[ -n "${PANEL_CZ_URL:-}"      ]] && SECRET_ARGS+=("PANEL_CZ_URL=$PANEL_CZ_URL")
  [[ -n "${PANEL_CZ_USERNAME:-}" ]] && SECRET_ARGS+=("PANEL_CZ_USERNAME=$PANEL_CZ_USERNAME")
  [[ -n "${PANEL_CZ_PASSWORD:-}" ]] && SECRET_ARGS+=("PANEL_CZ_PASSWORD=$PANEL_CZ_PASSWORD")
  [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]] && SECRET_ARGS+=("TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN")
  [[ -n "${ADMIN_TELEGRAM_ID:-}"  ]] && SECRET_ARGS+=("ADMIN_TELEGRAM_ID=$ADMIN_TELEGRAM_ID")
  if [[ ${#SECRET_ARGS[@]} -gt 0 ]]; then
    supabase secrets set "${SECRET_ARGS[@]}" --project-ref "$SUPABASE_REF" >/dev/null \
      || warn "Не все секреты записались — проверь Dashboard → Edge Functions → Secrets"
  fi
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
        proxy_pass ${SUPABASE_URL_VAL}/functions/v1/sub/;
        proxy_set_header Host ${SUPABASE_URL_VAL#https://};
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_ssl_server_name on;
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