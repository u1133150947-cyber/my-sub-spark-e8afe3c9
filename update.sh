#!/usr/bin/env bash
# =====================================================================
#  Быстрое обновление панели на сервере
#  - тянет свежий код из git
#  - ставит зависимости (если менялись)
#  - пересобирает фронт
#  - выкатывает в /var/www/panel и перезагружает nginx
#
#  Запуск из корня проекта:
#     sudo bash update.sh
# =====================================================================
set -euo pipefail

RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; CLR=$'\e[0m'
log()  { echo "${GRN}[+]${CLR} $*"; }
warn() { echo "${YLW}[!]${CLR} $*"; }
die()  { echo "${RED}[x]${CLR} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Запусти от root: sudo bash update.sh"
[[ -f package.json ]] || die "Нет package.json — запускай скрипт из корня проекта"

WEB_ROOT="/var/www/panel"

# ---------- git pull ----------
if [[ -d .git ]]; then
  log "git pull…"
  git pull --ff-only || die "git pull не удался — разрули конфликты вручную"
else
  warn "Это не git-репозиторий — пропускаю git pull, собираю что есть"
fi

# ---------- зависимости ----------
if ! npm ci --no-audit --no-fund; then
  warn "npm ci не прошёл — переключаюсь на npm install"
  npm install --no-audit --no-fund
fi

# ---------- сборка ----------
log "npm run build…"
npm run build
[[ -d dist ]] || die "Сборка не создала dist/"

# ---------- деплой ----------
log "Копирую билд в ${WEB_ROOT}…"
mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"*
cp -r dist/* "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"

# ---------- reload nginx ----------
log "nginx -t && reload…"
nginx -t
systemctl reload nginx

echo
echo "${GRN}[✓] Обновлено${CLR}"