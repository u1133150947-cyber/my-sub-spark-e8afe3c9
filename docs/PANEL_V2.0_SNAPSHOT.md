# Panel v2.0 — Snapshot стабильной версии

**Дата:** 2026-05-27
**Git commit:** `cab3152b0866109dec8f3a70d8258abf9d1516f8`
**Сообщение коммита:** `Удалён лишнее дублирование`

## Что входит в v2.0 (зафиксированная рабочая версия)

### Edge Functions
- `supabase/functions/sub/` (1060 строк) — генерация подписки `/sub/{slug}` для клиентов (VLESS, Hysteria2).
  Возвращает base64-список ссылок на серверы из `subscription_inbounds` + `external_subs`.
  Заголовки: `Subscription-Userinfo`, `Profile-Update-Interval`, `Profile-Title`.
- `supabase/functions/panel/` (1436 строк) — прокси к 3x-ui панелям (CZ, RU и др.) для синхронизации
  inbound'ов, клиентов, трафика. Использует креды из секретов `PANEL_*_URL/USERNAME/PASSWORD`.
- `supabase/functions/admin-auth/` (141) — вход админа по коду из Telegram-бота.
- `supabase/functions/hy2-auth/` (57) — auth-callback для Hysteria2 (валидация UUID клиента).
- `supabase/functions/ssh-cz-uuid/` (46) — SSH-команда на CZ-сервере для извлечения UUID xray.

### Frontend (страница админа)
- `src/pages/Login.tsx` — экран входа по коду из Telegram.
- `src/pages/Index.tsx` — главная админка (вкладки: панели, подписки, внешние, статистика).
- Компоненты: `PanelsManager`, `ExternalSubsPanel`, `StatsDashboard`, `OnlineClients`, `UpdatePanel`.

### База данных (схема public, на момент v2.0)
Таблицы:
- `panels` — 3x-ui панели (CZ, RU). Креды SSH/панели.
- `standalone_servers` — отдельно стоящие Hysteria-сервера.
- `subscriptions` — подписки клиентов (`slug`, `client_uuid`, `expiry_ms`, `total_bytes`, `raw_links`, `sni_whitelist`).
- `subscription_inbounds` — какие inbound'ы (серверы) входят в подписку.
- `subscription_external_subs` — какие внешние подписки прицеплены.
- `external_subs` — внешние подписки (агрегация).
- `client_mappings` — маппинг email клиента → subscription_id (для трафик-снапшотов).
- `inbound_overrides` — переопределение `remark` для inbound'ов.
- `traffic_snapshots` — снапшоты `used_bytes` по подпискам.
- `panel_health` — пинг панелей.
- `audit_log` — лог действий.
- `admin_login_codes`, `admin_sessions` — авторизация админа.

### Инфраструктура (RU-сервер `82.202.128.147`)
После cleanup (см. предыдущие сообщения):
- RAM 337/958 MB (35%), Disk 2.5/8.5 GB (29%).
- Активные сервисы: `x-ui` (порты 2053/2096), `xray` (4430, 8443-8446), `hysteria-server` (UDP:443),
  `caddy` (80/443 TCP), `fail2ban`, `ssh`.
- Удалены: `sub-manager.service`, `/opt/sub-manager`, `deno`, `ModemManager`, `multipathd`, `udisks2`,
  `open-vm-tools`, `fwupd`, `snapd`, `unattended-upgrades`, старые бэкапы.

### Cron / расписания
- Sub-обновление на клиентах: `Profile-Update-Interval: 3` (часа).
- Трафик-снапшоты: (если запланированы) через `pg_cron` → `panel` функция.

### Секреты, от которых зависит работа v2.0
`PANEL_CZ_URL`, `PANEL_CZ_USERNAME`, `PANEL_CZ_PASSWORD`,
`PANEL_RU_URL`, `PANEL_RU_USERNAME`, `PANEL_RU_PASSWORD`,
`SSH_PANEL_HOST/USER/PASSWORD`, `SSH_CZ_PASSWORD`, `RU_SSH_PASSWORD`,
`ADMIN_BOT_TOKEN`, `ADMIN_TELEGRAM_ID`, `TELEGRAM_BOT_TOKEN`,
`TIMEWEB_*` (S3 бэкапы).

## Как откатиться к v2.0

Если новая фича (routing-profile) сломает прод:

1. **Через интерфейс Lovable:** в истории чата найти сообщение от 27.05.2026
   ("Удалён лишнее дублирование") и нажать **"Revert to this version"**.
2. **Через git (вручную):** откатить репозиторий на коммит `cab3152b0866109dec8f3a70d8258abf9d1516f8`.
3. **БД:** новые миграции для routing (если будут добавлены после v2.0) откатить вручную —
   `DROP TABLE` / `DROP COLUMN` для новых сущностей. Сама v2.0 БД-схема трогаться не будет
   (только добавления, не изменения существующих таблиц).
4. **Сервера:** v2.0 не требует правок на CZ/RU — на серверах ничего не трогаем при внедрении routing.

## Что добавляется ПОСЛЕ v2.0 (фича routing-profile)

- Edge-функция `routing-profile/index.ts` — отдаёт JSON-профиль маршрутизации для Happ под ключ `slug`.
- (Опционально) кэш `routing_rules_cache` в KV или Storage — чтобы не дёргать GitHub каждый запрос.
- UI: блок "Маршрутизация" на странице подписки с QR + deeplink в Happ.
- (Опционально) колонка `routing_profile` в `subscriptions` для выбора профиля (default / ru-direct / abroad).
- Внешний источник правил: `runetfreedom/russia-v2ray-custom-routing-rules` (GitHub).

Серверная часть (CZ/RU) НЕ затрагивается. Откат фичи = удалить новую функцию + UI-блок.