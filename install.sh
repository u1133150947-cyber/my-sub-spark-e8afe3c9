#!/usr/bin/env bash
# =====================================================================
#  Auto-installer для VPN-панели (Vite + Lovable Cloud)
#  Поддержка: Ubuntu 22.04 / 24.04
#
#  Что делает скрипт:
#   1. Ставит Node.js 20, nginx, git, apache2-utils, certbot
#   2. Спрашивает логин/пароль администратора и (опц.) домен
#   3. Собирает фронтенд (npm ci && npm run build)
#   4. Кладёт билд в /var/www/panel
#   5. Настраивает nginx + Basic Auth (htpasswd) + SPA-fallback
#   6. (Опц.) выпускает Let's Encrypt сертификат
#
#  Использование:
#     # из корня проекта (где лежит package.json):
#     sudo bash install.sh
#
#  Доступ к БД (Lovable Cloud) уже зашит в .env проекта,
#  отдельно ничего поднимать не нужно — фронт сам ходит в облако.
# =====================================================================
set -euo pipefail

RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; CLR=$'\e[0m'
log()  { echo "${GRN}[+]${CLR} $*"; }
warn() { echo "${YLW}[!]${CLR} $*"; }
die()  { echo "${RED}[x]${CLR} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Запусти от root: sudo bash install.sh"
[[ -f package.json ]] || die "Нет package.json — запускай скрипт из корня проекта"
[[ -f .env ]] || warn ".env не найден — фронт может не подключиться к Lovable Cloud"

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

SERVER_NAME="${DOMAIN:-_}"
WEB_ROOT="/var/www/panel"
HTPASSWD="/etc/nginx/.panel_htpasswd"
NGINX_CONF="/etc/nginx/sites-available/panel.conf"

# ---------- системные пакеты ----------
log "apt update + базовые пакеты…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git nginx apache2-utils ufw

if ! command -v node >/dev/null || [[ "$(node -v 2>/dev/null | cut -dv -f2 | cut -d. -f1)" -lt 20 ]]; then
  log "Ставлю Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
log "node $(node -v), npm $(npm -v)"

# ---------- сборка ----------
log "npm ci…"
npm ci --no-audit --no-fund
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