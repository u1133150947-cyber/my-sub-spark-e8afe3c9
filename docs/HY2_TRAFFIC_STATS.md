# Hysteria2 Traffic Stats — рабочая схема

Документ описывает как сейчас собирается статистика трафика c Hy2-нод и
отображается в дашборде. Если что-то «отвалилось» — иди по шагам сверху вниз.

## 1. Архитектура

```
клиент --Hy2--> нода (hysteria-server) --trafficStats:7653--+
                                                            |
                          +---------------------------------+
                          v
               edge `panel?action=stats`
                          |
                          +-- standalone_servers (host, stats_port, stats_secret)
                          +-- subscriptions       (id -> client_uuid)
                          +-- merge per client_uuid + 3x-ui usagePerSub
                                          |
                                          v
                        StatsDashboard (perSub + traffic_snapshots)
```

## 2. Что хранится в БД

Таблица `standalone_servers`:

| поле          | назначение                                                |
|---------------|-----------------------------------------------------------|
| `host`        | DNS-имя ноды (`decdn.panelsu.ru` и т.д.)                  |
| `port`        | порт Hy2 (обычно 443)                                     |
| `stats_port`  | порт trafficStats API (используем **7653**)               |
| `stats_secret`| Bearer-секрет, кладётся в `Authorization`                 |

Если у ноды `stats_port` или `stats_secret` пустые — edge её пропускает.

## 3. Конфиг hysteria-server на ноде

Файл: `/etc/hysteria/config.yaml` — добавить блок:

```yaml
trafficStats:
  listen: :7653
  secret: <тот же stats_secret что в БД>
```

Сгенерировать секрет:

```bash
openssl rand -hex 24
```

Перезапуск и проверка:

```bash
systemctl restart hysteria-server
systemctl status hysteria-server --no-pager
curl -sS -H "Authorization: $SECRET" http://127.0.0.1:7653/online
curl -sS -H "Authorization: $SECRET" http://127.0.0.1:7653/traffic
```

401 без секрета и 200 с секретом = ок.

## 4. Текущий список нод

| Страна | Host                  | IP              | stats          |
|--------|-----------------------|-----------------|----------------|
| SE     | se.panelsu.ru         | 150.241.70.207  | ✅ (порт 7653) |
| CZ     | czcdn.panelsu.ru      | 185.87.148.138  | ⏳ ждём SSH    |
| DE     | decdn.panelsu.ru      | 171.22.31.25    | ⏳ ждём SSH    |
| FI     | ficdn.panelsu.ru      | 31.76.77.237    | ⏳ ждём SSH    |
| RU     | rucdn.panelsu.ru      | 82.202.128.147  | ⏳ ждём SSH    |

После настройки на ноде:

```sql
UPDATE standalone_servers
SET stats_port = 7653, stats_secret = '<HEX>'
WHERE host = '<host>';
```

## 5. Edge function `panel?action=stats`

Файл: `supabase/functions/panel/index.ts`.

Логика:
1. Берёт `standalone_servers` где `stats_port` и `stats_secret` заданы.
2. Берёт `subscriptions (id, client_uuid)` — для матчинга по UUID.
3. Параллельно для каждой ноды: `GET http://<host>:<stats_port>/traffic`
   с `Authorization: <stats_secret>`, таймаут 8 сек (AbortController).
4. Мержит в `usagePerSub` по `client_uuid`. Внимание: в Hy2 `tx` = отдано
   клиенту (down у клиента), `rx` = принято от клиента (up). Если поменять —
   графики «зеркалятся».
5. Сливает данные 3x-ui панелей в ту же карту.
6. Возвращает `{ perSub, panelErrors }`.

## 6. График «Динамика за 24ч»

- Фронт пишет cumulative-значения в `traffic_snapshots`. Если меньше 2 точек —
  плейсхолдер «Накапливаем данные».
- `chartData` считает дельты между соседними снапшотами и **распределяет**
  пропорционально по часовым бакетам — иначе долгий gap превращается в
  фейковый спайк.

Если график сломан:
- Проверь `traffic_snapshots` за 24ч (`select count(*) ... where created_at > now() - interval '24h'`).
- Если пусто — никто не открывал страницу ⇒ снапшоты не пишутся.
  TODO: cron-вызов `panel?action=stats` раз в 5–10 минут.

## 7. Чек-лист «всё отвалилось»

1. Dashboard → toast «Ошибка статистики» — смотрим текст.
2. Supabase → Edge Function logs `panel` — `panelErrors` + стек.
3. На ноде: `systemctl status hysteria-server`, `journalctl -u hysteria-server -n 200`.
4. На ноде локально: `curl -H "Authorization: $S" http://127.0.0.1:7653/online`.
5. Снаружи: `curl -H "Authorization: $S" http://<host>:7653/traffic`.
6. БД: `select host, stats_port, stats_secret is not null from standalone_servers`.

## 8. Доступы

SSH-пароли НЕ в репозитории — только в Lovable Secrets:

- `SSH_PANEL_HOST` / `SSH_PANEL_USER` / `SSH_PANEL_PASSWORD` — общий шорткат.
- Для нод — отдельные секреты, формат `SSH_<COUNTRY>_PASSWORD`
  (`SSH_CZ_PASSWORD` уже есть, `RU_SSH_PASSWORD` тоже).

Раздел «Hy2 stats» в HelpPage дублирует основные команды чтобы фиксить
можно было из админки.

## 9. История изменений

- 2026-05-26: добавлены колонки `stats_port`, `stats_secret` в `standalone_servers`.
- 2026-05-26: SE-нода (`se.panelsu.ru`) переведена на 7653, секрет в БД.
- 2026-05-26: `panel?action=stats` теперь мержит Hy2 + 3x-ui usagePerSub.
- 2026-05-26: HelpPage перестроен с сайдбаром, добавлен раздел Hy2 stats.
