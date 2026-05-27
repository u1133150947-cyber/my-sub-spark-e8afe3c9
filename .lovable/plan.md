## Проблема

ОЗУ на RU: 843/961 MB (87.7%) на 1 vCPU / 8.65 GB диска. На сервере нужны только:
- **Hysteria 2** (через 3x-ui inbound)
- **3x-ui панель** (под Caddy на ru.panelsu.ru)
- **Xray-core** (бэк 3x-ui)
- **Caddy** (reverse proxy + сертификаты)

Всё остальное — наследие старых установок (h-ui / x-ui v1 / marzban / hiddify / nginx / тестовые скрипты в /root и /opt) — кандидаты на снос.

## Блокер

SSH-пароль `root@82.202.128.147` в БД пустой, старый `K!E2QAGrxYFx` уже не подходит (Authentication failed). **Нужен актуальный пароль** — без него на сервер не зайти.

## Шаги после получения пароля

### 1. Диагностика (read-only, ничего не трогаем)
- `free -h`, `df -h`, `uptime`
- `ps aux --sort=-%mem | head -20` — кто ест RAM
- `systemctl list-units --state=running` — что вообще крутится
- `ss -tlnpu` — какие порты заняты и каким процессом
- `dpkg -l | grep -Ei 'nginx|apache|x-ui|marzban|hiddify|hysteria|xray|sing-box|warp|cockpit|webmin'`
- `du -sh /opt/* /var/log/* /root/* /var/lib/docker 2>/dev/null`
- `journalctl --disk-usage`
- `docker ps -a` (если есть)
- `crontab -l` + `ls /etc/cron.*`

### 2. Сохранить пароль в БД
`UPDATE panels SET ssh_password = '...' WHERE slug = 'ru'` — чтобы дальше всё работало через панель и старые tmp-скрипты больше не плодить.

### 3. Безопасный снос (в порядке риска: от низкого к высокому)

**Точно лишнее:**
- Старые tmp-скрипты в `/root` и `/opt` (test-*, install-*, *.log) — после ревью
- `apt autoremove --purge` + `apt clean`
- `journalctl --vacuum-size=100M` (логи systemd обычно занимают сотни мб)
- Ротация `/var/log/*.gz`
- Residual пакеты (`dpkg -l | awk '/^rc/'`)

**Условно лишнее (если найдём при диагностике):**
- Старая `x-ui` v1 от sprov / vaxilu — если стоит параллельно с 3x-ui
- `h-ui`, `marzban`, `hiddify-manager` — если когда-то ставились
- `nginx` / `apache2` — если Caddy уже всё проксирует
- `cockpit`, `webmin` — старые веб-панели
- WARP / wgcf, если не используется в outbound
- Docker — если ни один контейнер не нужен (typically жрёт RAM)

**Для каждой находки** перед удалением:
- проверить, не слушает ли порт, нужный нам (2053, 443, 80, hysteria UDP)
- `systemctl stop` + `disable`, потом `apt purge` / `rm -rf` директорий
- после каждого блока — `free -h` и `systemctl status x-ui caddy` чтобы убедиться, что основное живо

### 4. Финальная проверка
- Панель `https://ru.panelsu.ru/` открывается
- Hysteria 2 inbound принимает подключения (тест клиентом)
- `free -h` показывает заметное снижение RAM
- Все наши подписки в `subscription_inbounds` с `panel='ru'` продолжают работать

## Что НЕ трогаем
- `x-ui` (3x-ui) и его БД `/etc/x-ui/x-ui.db`
- `xray` бинарь, который запускает 3x-ui
- `caddy` + `/etc/caddy/Caddyfile` + сертификаты `/root/cert/ru.panelsu.ru/`
- ssh / sshd_config / authorized_keys

---

**Дай SSH-пароль от `root@82.202.128.147` и переключи в build mode** — пройдусь по шагу 1, вернусь со списком конкретного мусора и подтверждением что валить, потом снесу.
