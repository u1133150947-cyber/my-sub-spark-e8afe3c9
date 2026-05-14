## План

### Шаг 1. Сменить креды панели CZ на сложные
Через SSH на 185.87.148.138 (с ретраями, т.к. канал нестабилен) выполнить:
- `x-ui setting -username 'cz_admin_x9K' -password 'Tz7$mQv2Lp8Wn4Rg!Hd' -port 2053 -webBasePath 'czpanel_a7f3k9'`
- `systemctl restart x-ui`
- Проверить `https://185.87.148.138:2053/czpanel_a7f3k9/` (HTTP 200) и логин через API.
- Обновить секреты Lovable Cloud: `PANEL_CZ_URL`, `PANEL_CZ_USERNAME`, `PANEL_CZ_PASSWORD`, плюс запись в таблице `panels` (slug `pd4e485d3c9`).

### Шаг 2. Создать Reality-инбаунд в новой панели
Через 3x-ui API (`/panel/api/inbounds/add`) создать VLESS Reality инбаунд:
- порт `2080` (как в текущем `display_remark` "🇨🇿 Европа | Стандартный")
- protocol: `vless`, flow: `xtls-rprx-vision`
- security: `reality`, dest: `www.google.com:443`, sni `www.google.com`, сгенерить новый x25519 keypair и shortIds
- remark в панели: `cz-europe-2080`
- одного «болванчика» клиента создать сразу для проверки работоспособности

### Шаг 3. Перезалить клиентов и пересобрать `subscription_inbounds`
Для каждой из 10 подписок:
1. Достать `client_email`, `client_uuid` из таблицы `subscriptions`.
2. Через API `/panel/api/inbounds/addClient` добавить клиента в новый CZ инбаунд (тот же UUID, email, без лимита трафика/срока — как в старой схеме).
3. Обновить запись в `subscription_inbounds` для `panel='pd4e485d3c9'`:
   - новый `inbound_id` (id, который вернёт API при создании инбаунда)
   - новый `port`, `host`, `stream_settings` (Reality public key, shortId, sni)
4. `inbound_overrides` для (`pd4e485d3c9`, новый id) уже хранит `🇨🇿 Европа | Стандартный` — обновить ссылку на новый `inbound_id`.

### Шаг 4. Верификация
- Прогнать одну подписку через edge-функцию агрегатора и убедиться, что в выдаче 2 ноды (CZ + RU) и оба ключа парсятся.
- Проверить, что vless://… от CZ имеет валидный pbk/sid и подключается (тест на «болванчике»).

### Шаг 5. Доступы пользователю
В чат прислать:
- URL панели + логин/пароль
- Где смотреть Reality-параметры (panel → inbound)
- Напоминание обновить подписку в клиенте (Hiddify / v2rayNG / Streisand) — UUID не меняется, но host/pbk/sid новые.

### Технические детали
- SSH к CZ: root@185.87.148.138, пароль уже сохранён в скриптах; делаем 15 ретраев по 90 c из-за нестабильности.
- API панели: cookie-сессия, логин `POST /czpanel_a7f3k9/login`, далее `POST /czpanel_a7f3k9/panel/api/inbounds/...`.
- Все DML по `subscription_inbounds`, `inbound_overrides`, `panels` пройдут через `supabase--insert` (UPDATE).
- Секреты — через `secrets--update_secret` для `PANEL_CZ_PASSWORD` (и при необходимости `PANEL_CZ_URL`, `PANEL_CZ_USERNAME`).
- Никаких изменений во фронте/edge-функциях не требуется — структура `stream_settings` в `subscription_inbounds` остаётся той же.
