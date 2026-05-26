import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ruInbounds = [
  { port: 8443, remark: "🇷🇺→🇨🇿 Чехия (8443)", purpose: "Каскад в CZ" },
  { port: 8444, remark: "🇷🇺→🇩🇪 Германия (8444)", purpose: "Каскад в DE" },
  { port: 8445, remark: "🇷🇺→🇫🇮 Финляндия (8445)", purpose: "Каскад в FI" },
  { port: 8446, remark: "🇷🇺→🇸🇪 Швеция (8446)", purpose: "Каскад в SE" },
  { port: 4430, remark: "🇷🇺 YouTube Direct (4430)", purpose: "Прямой YouTube без рекламы" },
];

const exitNodes = [
  { server: "CZ", remark: "🇨🇿 Exit Чехия (8443)" },
  { server: "DE", remark: "🇩🇪 Exit Германия (8443)" },
  { server: "FI", remark: "🇫🇮 Exit Финляндия (8443)" },
  { server: "SE", remark: "🇸🇪 Exit Швеция (8443)" },
];

const panelDomains = [
  { country: "🇷🇺 RU", panel: "ru.panelsu.ru",  note: "x-ui панель (главный вход каскада) + Caddy на :443 для web.panelsu.ru" },
  { country: "🇨🇿 CZ", panel: "cz.panelsu.ru",  note: "x-ui панель, exit-нода каскада" },
  { country: "🇩🇪 DE", panel: "de.panelsu.ru",  note: "x-ui панель, exit-нода каскада" },
  { country: "🇫🇮 FI", panel: "fi.panelsu.ru",  note: "x-ui панель, exit-нода каскада" },
  { country: "🇸🇪 SE", panel: "se.panelsu.ru",  note: "x-ui панель, exit-нода каскада" },
];

const hy2Nodes = [
  { country: "🇷🇺 RU", domain: "rucdn.panelsu.ru", ip: "82.202.128.147" },
  { country: "🇨🇿 CZ", domain: "czcdn.panelsu.ru", ip: "185.87.148.138" },
  { country: "🇩🇪 DE", domain: "decdn.panelsu.ru", ip: "171.22.31.25" },
  { country: "🇫🇮 FI", domain: "ficdn.panelsu.ru", ip: "31.76.77.237"  },
  { country: "🇸🇪 SE", domain: "se.panelsu.ru",    ip: "87.121.105.143", note: "использует основной поддомен (на сервере нет панели)" },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Инструкция: схема инбаундов</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Каскадная архитектура: RU — точка входа, иностранные сервера — exit-ноды на порту 8443.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RU сервер (ru.panelsu.ru) — вход</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Порт</TableHead>
                <TableHead>Remark в 3x-ui</TableHead>
                <TableHead>Назначение</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ruInbounds.map((r) => (
                <TableRow key={r.port}>
                  <TableCell className="font-mono">{r.port}</TableCell>
                  <TableCell>{r.remark}</TableCell>
                  <TableCell className="text-muted-foreground">{r.purpose}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Иностранные сервера — exit-ноды (порт 8443)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Сервер</TableHead>
                <TableHead>Remark в 3x-ui</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exitNodes.map((r) => (
                <TableRow key={r.server}>
                  <TableCell className="font-mono">{r.server}</TableCell>
                  <TableCell>{r.remark}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Как читать названия</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-mono">🇷🇺→🇨🇿</span> — каскад: трафик заходит в RU и выходит в CZ.</p>
          <p><span className="font-mono">Exit</span> — конечный узел, принимает каскадный трафик от RU.</p>
          <p><span className="font-mono">Direct</span> — прямой выход с RU (без каскада), для YouTube.</p>
          <p>Порт в названии = порт инбаунда на сервере, удобно для быстрого поиска в 3x-ui.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Поддомены панелей x-ui</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Страна</TableHead>
                <TableHead>Поддомен</TableHead>
                <TableHead>Назначение</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {panelDomains.map((r) => (
                <TableRow key={r.panel}>
                  <TableCell className="font-mono">{r.country}</TableCell>
                  <TableCell className="font-mono">{r.panel}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hysteria 2 — ноды и поддомены</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Для Hy2 используются отдельные поддомены вида <span className="font-mono">*cdn.panelsu.ru</span> —
            чтобы не палить назначение и не конфликтовать с панелью на основном поддомене.
            Hy2 слушает <span className="font-mono">UDP/443</span>, панель x-ui остаётся на TCP — конфликтов по портам нет.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Страна</TableHead>
                <TableHead>Hy2 поддомен</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Примечание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hy2Nodes.map((r) => (
                <TableRow key={r.domain}>
                  <TableCell className="font-mono">{r.country}</TableCell>
                  <TableCell className="font-mono">{r.domain}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ip}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.note ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Как устанавливается Hysteria 2 (раскатка ноды)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <b>DNS.</b> Добавить A-запись <span className="font-mono">{`<country>cdn.panelsu.ru`}</span> →
              IP сервера. <b>Cloudflare proxy ОБЯЗАТЕЛЬНО выключить</b> (серое облачко, DNS only) —
              CF не пропускает UDP, Hy2 не заработает.
            </li>
            <li>
              <b>Зависимости:</b> <span className="font-mono">apt-get install -y curl socat ca-certificates</span>.
              На занятых серверах использовать <span className="font-mono">apt -o DPkg::Lock::Timeout=180</span>.
            </li>
            <li>
              <b>Сертификат Let's Encrypt</b> через acme.sh в standalone-режиме (порт 80 должен быть свободен — на время
              временно остановить <span className="font-mono">nginx/caddy</span>):
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`curl -fsSL https://get.acme.sh | sh -s email=admin@panelsu.ru
~/.acme.sh/acme.sh --set-default-ca --server letsencrypt
~/.acme.sh/acme.sh --issue -d <domain> --standalone -k ec-256`}</pre>
            </li>
            <li>
              <b>Hysteria 2:</b>
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`bash <(curl -fsSL https://get.hy2.sh/)
# создать юзера если установщик не создал:
useradd -r -s /usr/sbin/nologin -M -d /var/lib/hysteria hysteria`}</pre>
            </li>
            <li>
              <b>Сертификаты для Hy2.</b> Копировать в <span className="font-mono">/etc/hysteria/certs/</span> и поставить
              <span className="font-mono"> chmod 644</span> (640 не хватает — служба не читает .key даже у владельца на
              некоторых ядрах с AppArmor):
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`mkdir -p /etc/hysteria/certs
cp ~/.acme.sh/<domain>_ecc/fullchain.cer /etc/hysteria/certs/<domain>.crt
cp ~/.acme.sh/<domain>_ecc/<domain>.key   /etc/hysteria/certs/<domain>.key
chown -R hysteria:hysteria /etc/hysteria/certs
chmod 644 /etc/hysteria/certs/*`}</pre>
              И поставить <span className="font-mono">--install-cert --reloadcmd</span> чтобы при renew права/перезапуск делались автоматически.
            </li>
            <li>
              <b>Конфиг</b> <span className="font-mono">/etc/hysteria/config.yaml</span>:
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`listen: :443
tls:
  cert: /etc/hysteria/certs/<domain>.crt
  key:  /etc/hysteria/certs/<domain>.key
auth:
  type: http
  http:
    url: https://web.panelsu.ru/api/hy2/auth
    insecure: false
bandwidth: { up: 1 gbps, down: 1 gbps }
masquerade:
  type: proxy
  proxy: { url: https://bing.com, rewriteHost: true }`}</pre>
              Авторизация централизованная — Hy2 на каждом сервере дёргает <span className="font-mono">/api/hy2/auth</span> на нашем web,
              там матчится по client UUID из подписки.
            </li>
            <li>
              <b>systemd override</b> при необходимости (если у юзера hysteria нет валидного <span className="font-mono">home</span>):
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`mkdir -p /etc/systemd/system/hysteria-server.service.d
printf '[Service]\\nWorkingDirectory=/etc/hysteria\\n' \\
  > /etc/systemd/system/hysteria-server.service.d/override.conf
systemctl daemon-reload`}</pre>
            </li>
            <li>
              <b>Старт и проверка:</b>
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`systemctl enable --now hysteria-server
systemctl is-active hysteria-server   # active
ss -lunp | grep :443                  # должен быть hysteria на UDP/443`}</pre>
            </li>
            <li>
              <b>Регистрация в нашей панели.</b> Добавить запись в <span className="font-mono">standalone_servers</span>:
              имя <span className="font-mono">"🇽🇽 Country Hysteria 2"</span>, host —
              <span className="font-mono"> &lt;country&gt;cdn.panelsu.ru</span>, port <span className="font-mono">443</span>.
              После этого нода появляется в выборе при создании подписки.
            </li>
          </ol>
          <p className="text-muted-foreground">
            Важно: Hy2 = UDP/443, x-ui панель = TCP/различные порты — друг другу не мешают,
            поэтому Hy2 спокойно стоит на том же сервере, что и панель.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Каскад RU → exit (как настроено)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Идея: клиент коннектится <b>только к RU</b> (ru.panelsu.ru). На RU стоят отдельные
            inbound'ы на портах <span className="font-mono">8443–8446</span>, каждый из которых через outbound
            на 3x-ui отправляет трафик на нужный exit-сервер на его inbound <span className="font-mono">8443</span>.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>RU <span className="font-mono">:8443</span> → CZ <span className="font-mono">:8443</span></li>
            <li>RU <span className="font-mono">:8444</span> → DE <span className="font-mono">:8443</span></li>
            <li>RU <span className="font-mono">:8445</span> → FI <span className="font-mono">:8443</span></li>
            <li>RU <span className="font-mono">:8446</span> → SE <span className="font-mono">:8443</span></li>
            <li>RU <span className="font-mono">:4430</span> — Direct YouTube (без каскада, выходит с RU)</li>
          </ul>
          <p>
            Применяется скриптом <span className="font-mono">/root/cascade-apply.py</span> на RU (живёт там).
            Клиентский UUID одинаковый на RU и на exit'ах — поэтому подписке достаточно знать только RU-ссылку.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}