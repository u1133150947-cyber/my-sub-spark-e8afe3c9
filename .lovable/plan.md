## План: каскад RU → CZ (3x-ui Reality)

Идея гайда: клиент подключается к RU-серверу, RU-сервер через outbound шлёт весь трафик на CZ-сервер. Для пользователя это выглядит как «российский IP в подписке», но реально выходим в интернет с CZ.

### Шаг 1. CZ-панель: новый Reality-инбаунд под каскад

`https://185.87.148.138:2053/czpanel_a7f3k9/`

Через 3x-ui API создать VLESS Reality inbound:
- port `8443`
- protocol `vless`, flow `xtls-rprx-vision`
- security `reality`, dest `ya.ru:443`, serverNames `["ya.ru"]`
- сгенерить отдельный x25519 keypair и shortId через `/server/getNewX25519Cert`
- один клиент `cascade-ru` с фиксированным UUID (этот UUID будет вшит в RU outbound)
- remark в панели: `cz-cascade-8443`
- sniffing: enabled (http, tls, quic)

Сохранить `pbk`, `sid`, `uuid`, `sni=ya.ru` — это пойдёт в RU outbound.

### Шаг 2. RU-панель: симметричный inbound :8443

`https://ru.panelsu.ru/` (логин из секретов `PANEL_RU_*`)

Создать такой же VLESS Reality inbound:
- port `8443`
- protocol `vless`, flow `xtls-rprx-vision`
- security `reality`, dest `ya.ru:443`, serverNames `["ya.ru"]`
- свой keypair / shortId (НЕ совпадают с CZ — это inbound-сторона для клиента)
- один тестовый клиент с UUID для самой подписки
- remark `ru-cascade-in-8443`
- tag inbound — запомнить (3x-ui автоматически даёт `inbound-8443`)

### Шаг 3. RU-панель: outbound на CZ

3x-ui v2.6.7 хранит outbound'ы в Xray-конфиге. Способ:
1. Через API `/panel/xray/` достать текущий xray template (json).
2. В массив `outbounds` добавить блок:
   ```json
   {
     "tag":"cascade-cz",
     "protocol":"vless",
     "settings":{"vnext":[{
       "address":"185.87.148.138","port":8443,
       "users":[{"id":"<UUID из CZ:8443 клиента cascade-ru>",
                 "encryption":"none","flow":"xtls-rprx-vision"}]
     }]},
     "streamSettings":{
       "network":"tcp","security":"reality",
       "realitySettings":{
         "serverName":"ya.ru","fingerprint":"chrome",
         "publicKey":"<pbk из CZ>","shortId":"<sid из CZ>",
         "spiderX":"/"
       }
     }
   }
   ```
3. Поставить `cascade-cz` ПЕРВЫМ в массиве outbounds.
4. Сохранить через `/panel/xray/update`.

### Шаг 4. RU-панель: routing rule inbound-8443 → cascade-cz

В тот же xray-конфиге, в `routing.rules`, добавить:
```json
{ "type":"field", "inboundTag":["inbound-8443"], "outboundTag":"cascade-cz" }
```
И поставить ПЕРЕД дефолтными правилами. Сохранить, рестартнуть xray (3x-ui делает это автоматом при update).

### Шаг 5. Verify

1. SSH на RU: `xray -test -c /usr/local/x-ui/bin/config.json` чтобы убедиться, что конфиг валидный.
2. Сгенерировать клиентский vless:// для RU:8443 (UUID клиентского inbound, pbk/sid из RU inbound).
3. Локально парсить ссылку. Полная проверка коннекта через Hiddify будет на стороне пользователя.
4. Через RU-сервер прогнать `curl ifconfig.me` после поднятия Xray — проверить, что выходной IP = CZ (185.87.148.138).

### Шаг 6. Где может сломаться

- 3x-ui template в RU может уже содержать кастомные outbound'ы — не затереть, только добавить.
- `mldsa65 Verify` из гайда — это пост-квант ключ Reality, появился в Xray 25.x. В 3x-ui v2.6.7 + соответствующем Xray поля может не быть — оставляю пустым, обычный x25519 работает.
- Если RU за NAT/фаерволом — открыть :8443.
- Если на RU-панели уже висит inbound на :8443 — выбрать другой порт (например, 8843) и так же зеркально на CZ.

### Что НЕ трогаем

- БД (`subscriptions`/`subscription_inbounds` пустые — пересинхронизировать нечего).
- Старый CZ inbound id=1 на :2080 (его оставляем как «прямой» вариант для прямого VLESS-CZ).

После одобрения переключаюсь в build, делаю всё через 3x-ui API без ручного SSH к Xray-конфигам где возможно.
