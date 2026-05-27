## Цель

На зарубежных нодах вырезать рекламу YouTube, отправляя только YouTube/Google-Ads трафик через RU-сервер по SOCKS5. Всё остальное продолжает выходить через зарубежную ноду напрямую.

Архитектура:

```text
Клиент → CZ (xray)
           ├─ geosite:youtube + geosite:google-ads → SOCKS5 → RU:1080 → интернет
           └─ остальное → freedom (CZ напрямую)
```

После проверки на CZ — раскатываем тот же routing на DE / FI / SE.

## Этап 1. RU: поднять SOCKS5 inbound

На `82.202.128.147` (RU, x-ui):

1. В x-ui добавить inbound:
   - protocol: `socks`
   - listen: `0.0.0.0`
   - port: `11080` (внешний, нестандартный)
   - settings: `auth=password`, аккаунт `yt-relay` + длинный пароль (сохранить в Supabase secret `RU_SOCKS_PASSWORD`)
   - udp: `true` (нужно для QUIC YouTube)
2. Firewall: `iptables`/`nft` — `ACCEPT tcp/udp 11080` только с IP зарубежных нод (CZ `185.87.148.138`, позже DE/FI/SE). Всем остальным — DROP.
3. Проверить с CZ: `curl -x socks5h://yt-relay:PASS@82.202.128.147:11080 https://ifconfig.me` → должен вернуть RU IP.

## Этап 2. CZ: routing YouTube → RU SOCKS

На `185.87.148.138`, через 3x-ui отредактировать xray template (`settings.xrayTemplateConfig`):

**outbounds** — добавить:
```json
{
  "tag": "ru-socks",
  "protocol": "socks",
  "settings": {
    "servers": [{
      "address": "82.202.128.147",
      "port": 11080,
      "users": [{ "user": "yt-relay", "pass": "<RU_SOCKS_PASSWORD>" }]
    }]
  }
}
```

**routing.rules** — в начало списка:
```json
{ "type": "field", "outboundTag": "ru-socks",
  "domain": ["geosite:youtube", "geosite:google-ads",
             "domain:googlevideo.com", "domain:ytimg.com",
             "domain:youtube-nocookie.com", "domain:youtu.be"] }
```

Existing freedom/direct outbound остаётся дефолтным для всего остального.

Перезапустить xray: `systemctl restart x-ui`.

## Этап 3. Проверка на CZ

С клиента, подключённого к CZ-инбаунду текущей подписки:
1. `curl https://ifconfig.me` → CZ IP (ничего не сломалось).
2. `curl https://www.youtube.com -v` (или открыть YouTube в браузере + `chrome://net-internals`) → IP/маршрут до googlevideo должен быть RU.
3. Открыть видео — проверить что preroll/midroll реклама пропадает (за счёт того, что googlevideo ходит через RU, где Google отдаёт сильно меньше рекламы / другие правила).
4. Проверить QUIC/UDP (YouTube любит h3): убедиться что 11080/udp реально проходит. Если нет — отключить h3 в браузере для теста или принять fallback на TCP.

Логи смотрим: `journalctl -u x-ui -f` на CZ и `journalctl -u x-ui -f` на RU.

## Этап 4. Раскатка на DE / FI / SE

Скрипт `setup-yt-relay.ts` (по аналогии с `configure-h2-servers.ts`):
- читает `panels` из Supabase
- для каждой ноды кроме RU добавляет в xray template тот же `ru-socks` outbound + routing rule (идемпотентно: проверяет наличие tag `ru-socks` перед вставкой)
- перезапускает x-ui
- логирует результат в `audit_log`

Firewall на RU обновляем — добавляем DE/FI/SE IP в whitelist 11080.

## Технические детали

- **Почему SOCKS, а не VLESS-туннель RU↔CZ**: проще в xray (один outbound, без TLS-обвязки), а защиту даёт firewall whitelist по source IP + пароль. Open SOCKS наружу без whitelist — нельзя.
- **UDP**: socks outbound в xray поддерживает UDP, нужно для QUIC YouTube. Если будут проблемы — добавим `"settings.udp": true` и `sniffing.enabled: true` с `destOverride: ["http","tls","quic"]` в inbound на CZ.
- **Geosite**: `geosite:youtube` уже включает основные домены, `geosite:google-ads` режет рекламные эндпоинты. Дополнительные `domain:googlevideo.com` и т.д. — подстраховка на случай устаревшего geosite-файла.
- **Sniffing** на CZ inbound должен быть включён (иначе routing по домену не сработает для TLS) — у вас, судя по предыдущим конфигам, уже так.
- **Secret**: пароль SOCKS — в Supabase secret `RU_SOCKS_PASSWORD`, скрипты раскатки читают оттуда.
- **Откат**: достаточно убрать routing rule и outbound `ru-socks` из template и перезапустить x-ui. Бэкап template сохраняем перед изменением.

## Риски

- YouTube определяет RU IP → может показать региональные ограничения / другой набор рекламы (вместо отсутствия). В этом случае поможет связка RU SOCKS → WARP, но это уже следующий шаг.
- Скорость YouTube ограничится каналом RU-ноды и линком CZ↔RU. Для Самары это, наоборот, скорее плюс.
- Если RU нода ляжет — YouTube перестанет грузиться на всех зарубежных нодах. Можно добавить fallback rule `balancerTag` на direct, но усложнит конфиг — отложим.
