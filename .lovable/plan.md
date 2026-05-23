## Что не так

1. **Обновление из GitHub не работает** — в `server/update.ts` зашит дефолт `GITHUB_REPO = u1133150947-cyber/my-sub-spark-df6a54d2`, а реальный публичный репозиторий — `u1133150947-cyber/my-sub-spark-9db9c9f2`. На сервере переменная окружения `GITHUB_REPO` не выставлена, поэтому `/api/version` стучится в несуществующий репо и кнопка «Обновить» либо не появляется, либо падает с 404.

2. **Кнопки «Создать 10 тестовых аккаунтов» / «Создать 25 inbounds»** в самой Lovable-кодовой базе уже не отрисовываются (в `src/` их нет), но в проекте остались серверные хендлеры `server/testAccounts.ts`, `server/testInbounds.ts` и роуты в `server/main.ts` (`/api/test-accounts`, `/api/test-inbounds`). На сервере крутится старый собранный фронт, где кнопки ещё есть — после рассинхрона свежим кодом из GitHub они исчезнут вместе со старым `dist/`.

## План

### 1. Правка кода в Lovable (auto-push в GitHub)

- `server/update.ts`: заменить дефолт `GITHUB_REPO` на `u1133150947-cyber/my-sub-spark-9db9c9f2`.
- `server/main.ts`: убрать импорты `handleTestAccounts`, `handleTestInbounds` и оба роута (`/api/test-accounts`, `/api/test-inbounds`), включая упоминания в allowlist.
- Удалить файлы `server/testAccounts.ts` и `server/testInbounds.ts`.
- Поднять `src/version.ts` → `APP_VERSION = "v95"`, дату — на сегодня.

### 2. Накат на сервер `web.panelsu.ru` (по SSH, как в прошлый раз)

```
# 0. бэкап data + текущий код
tar -czf /root/sub-manager-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
        -C /opt/sub-manager data .env
tar -czf /root/sub-manager-fullsnap-$(date +%Y%m%d-%H%M%S).tar.gz \
        -C /opt sub-manager

# 1. зафиксировать правильный repo на будущее
grep -q '^GITHUB_REPO=' /opt/sub-manager/.env \
  && sed -i 's|^GITHUB_REPO=.*|GITHUB_REPO=u1133150947-cyber/my-sub-spark-9db9c9f2|' /opt/sub-manager/.env \
  || echo 'GITHUB_REPO=u1133150947-cyber/my-sub-spark-9db9c9f2' >> /opt/sub-manager/.env

# 2. накатить свежий код (rsync из /dev-server, как в прошлый раз)
#    (исключая node_modules/.git/dist/data/.env)
#    и записать VERSION = последний sha
bash /tmp/sub-manager-new/update.sh

# 3. рестарт + проверка
systemctl restart sub-manager
systemctl is-active sub-manager
curl -sS https://web.panelsu.ru/api/version | jq
```

### 3. Проверка

- `GET /api/version` возвращает `update_available: false` и правильный `repo`.
- В UI «Обновление панели» показывает зелёный «У вас последняя версия».
- Кнопки «Создать 10 тестовых аккаунтов» / «Создать 25 inbounds» исчезли из панели.
- `https://web.panelsu.ru/sub/bpmt55pfr9db` отвечает 200.

### Откат

```
systemctl stop sub-manager
rm -rf /opt/sub-manager
tar -xzf /root/sub-manager-fullsnap-*.tar.gz -C /opt
systemctl start sub-manager
```

## Что НЕ трогаю в этой итерации

- CDN-vless генерация (это отдельный баг, уйдёт следующей задачей).
- Логика самого update.sh / Caddy / nginx — оставляем как есть.
