import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Network, Server, Globe, Workflow, Shield, BarChart3, BookOpen,
} from "lucide-react";

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

type SectionId =
  | "overview"
  | "ru-inbounds"
  | "exit-nodes"
  | "panels"
  | "hy2-nodes"
  | "hy2-install"
  | "hy2-stats"
  | "cascade";

const sections: { id: SectionId; title: string; group: string; icon: any }[] = [
  { id: "overview",    title: "Обзор архитектуры",        group: "Общее",       icon: BookOpen },
  { id: "ru-inbounds", title: "RU сервер — вход",         group: "VLESS каскад", icon: Network },
  { id: "exit-nodes",  title: "Exit-ноды (8443)",         group: "VLESS каскад", icon: Server },
  { id: "cascade",     title: "Каскад RU → exit",         group: "VLESS каскад", icon: Workflow },
  { id: "panels",      title: "Поддомены панелей x-ui",   group: "Инфраструктура", icon: Globe },
  { id: "hy2-nodes",   title: "Hysteria 2 — ноды",        group: "Hysteria 2",   icon: Server },
  { id: "hy2-install", title: "Установка Hy2 на ноду",    group: "Hysteria 2",   icon: Shield },
  { id: "hy2-stats",   title: "Включение trafficStats",   group: "Hysteria 2",   icon: BarChart3 },
];

export default function HelpPage() {
  const [active, setActive] = useState<SectionId>("overview");

  const grouped = sections.reduce<Record<string, typeof sections>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex gap-6 p-6 min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 sticky top-6 self-start">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Документация
          </h2>
        </div>
        <nav className="space-y-5">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-2 mb-1 text-xs font-medium text-muted-foreground/70 uppercase">
                {group}
              </div>
              <ul className="space-y-0.5">
                {items.map((s) => {
                  const Icon = s.icon;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setActive(s.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
                          active === s.id
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{s.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 max-w-4xl space-y-6">
        {active === "overview" && <OverviewSection />}
        {active === "ru-inbounds" && <RuInboundsSection />}
        {active === "exit-nodes" && <ExitNodesSection />}
        {active === "panels" && <PanelsSection />}
        {active === "hy2-nodes" && <Hy2NodesSection />}
        {active === "hy2-install" && <Hy2InstallSection />}
        {active === "hy2-stats" && <Hy2StatsSection />}
        {active === "cascade" && <CascadeSection />}
      </main>
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function OverviewSection() {
  return (
    <>
      <PageHeader
        title="Обзор архитектуры"
        subtitle="Каскадная схема: RU — точка входа, иностранные сервера — exit-ноды. Параллельно работает Hysteria 2 на отдельных *cdn-поддоменах."
      />
      <Card>
        <CardHeader><CardTitle>Что где живёт</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><b>VLESS Reality:</b> клиент подключается к <span className="font-mono">ru.panelsu.ru</span>, RU маршрутизирует трафик в нужный exit (CZ/DE/FI/SE) по портам 8443–8446. Direct YouTube — порт 4430.</p>
          <p><b>Hysteria 2:</b> отдельные ноды на <span className="font-mono">*cdn.panelsu.ru</span>, UDP/443. Авторизация централизованная через <span className="font-mono">/api/hy2/auth</span>.</p>
          <p><b>Панели x-ui:</b> на каждом сервере (кроме SE) есть своя панель на TCP, не конфликтует с Hy2 на UDP.</p>
          <p>Подробности — в разделах слева.</p>
        </CardContent>
      </Card>
    </>
  );
}

function RuInboundsSection() {
  return (
    <>
      <PageHeader title="RU сервер (ru.panelsu.ru) — вход" />
      <Card>
        <CardHeader>
          <CardTitle>Inbound'ы на RU</CardTitle>
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
        <CardHeader><CardTitle>Как читать названия</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-mono">🇷🇺→🇨🇿</span> — каскад: трафик заходит в RU и выходит в CZ.</p>
          <p><span className="font-mono">Exit</span> — конечный узел, принимает каскадный трафик от RU.</p>
          <p><span className="font-mono">Direct</span> — прямой выход с RU (без каскада), для YouTube.</p>
          <p>Порт в названии = порт инбаунда на сервере, удобно для быстрого поиска в 3x-ui.</p>
        </CardContent>
      </Card>
    </>
  );
}

function ExitNodesSection() {
  return (
    <>
      <PageHeader title="Иностранные сервера — exit-ноды (порт 8443)" />
      <Card>
        <CardHeader>
          <CardTitle>Exit-ноды</CardTitle>
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
    </>
  );
}

function PanelsSection() {
  return (
    <>
      <PageHeader title="Поддомены панелей x-ui" />
      <Card>
        <CardHeader>
          <CardTitle>Список панелей</CardTitle>
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
    </>
  );
}

function Hy2NodesSection() {
  return (
    <>
      <PageHeader
        title="Hysteria 2 — ноды и поддомены"
        subtitle="Отдельные *cdn-поддомены, UDP/443. Cloudflare proxy всегда выключен."
      />
      <Card>
        <CardHeader>
          <CardTitle>Список Hy2 нод</CardTitle>
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
    </>
  );
}

function Hy2InstallSection() {
  return (
    <>
      <PageHeader title="Установка Hysteria 2 на ноду" subtitle="Полный цикл: DNS → сертификат → бинарь → конфиг → регистрация в панели." />
      <Card>
        <CardHeader>
          <CardTitle>Пошаговая раскатка</CardTitle>
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
    </>
  );
}

function Hy2StatsSection() {
  return (
    <>
      <PageHeader
        title="Включение Hy2 trafficStats"
        subtitle="Чтобы статистика трафика по Hy2 попадала в Dashboard вместе с 3x-ui."
      />
      <Card>
        <CardHeader><CardTitle>Зачем</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            Hy2 по умолчанию <b>не отдаёт</b> per-user статистику. Чтобы Dashboard видел трафик с Hy2-нод,
            на каждом Hy2-сервере нужно включить блок <span className="font-mono">trafficStats</span> в
            <span className="font-mono"> /etc/hysteria/config.yaml</span> с уникальным секретом, и записать
            <span className="font-mono"> stats_port / stats_secret</span> в таблицу
            <span className="font-mono"> standalone_servers</span>. Edge function <span className="font-mono">panel?action=stats</span>
            затем ходит на <span className="font-mono">http://host:port/traffic</span> с заголовком
            <span className="font-mono"> Authorization: &lt;secret&gt;</span> и мерджит трафик по <span className="font-mono">auth_id</span> (= client UUID).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Шаги на сервере</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-3">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <b>Зайти по SSH</b> на нужный Hy2-сервер (root + пароль из заметок).
            </li>
            <li>
              <b>Сгенерировать секрет</b> (24 байта hex):
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`openssl rand -hex 24`}</pre>
            </li>
            <li>
              <b>Выбрать локальный порт</b> для API (по умолчанию используем <span className="font-mono">7653</span>).
              API биндим только на <span className="font-mono">127.0.0.1</span> — наружу не выпускаем, edge function ходит туда через SSH/прокси
              или через явно открытый порт + secret. На SE используем порт <span className="font-mono">7653</span> открытый наружу + Authorization.
            </li>
            <li>
              <b>Дописать в</b> <span className="font-mono">/etc/hysteria/config.yaml</span>:
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`trafficStats:
  listen: :7653          # или 127.0.0.1:7653 если не наружу
  secret: <SECRET_HEX>`}</pre>
            </li>
            <li>
              <b>Перезапустить и проверить:</b>
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`systemctl restart hysteria-server
systemctl is-active hysteria-server
# должен ответить 401 без секрета и 200 с секретом:
curl -s -o /dev/null -w "%{http_code}\\n" http://127.0.0.1:7653/traffic
curl -s -H "Authorization: <SECRET>" http://127.0.0.1:7653/traffic`}</pre>
            </li>
            <li>
              <b>Если порт наружу</b> (как на SE) — открыть в firewall:
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`ufw allow 7653/tcp   # или iptables, в зависимости от сервера`}</pre>
            </li>
            <li>
              <b>Записать в БД</b> в таблицу <span className="font-mono">standalone_servers</span> для этой ноды
              поля <span className="font-mono">stats_port</span> и <span className="font-mono">stats_secret</span>:
              <pre className="bg-muted rounded p-2 mt-1 text-xs overflow-x-auto">{`update public.standalone_servers
   set stats_port = 7653,
       stats_secret = '<SECRET>'
 where host = '<country>cdn.panelsu.ru';`}</pre>
            </li>
            <li>
              <b>Проверить Dashboard</b> — после следующего тика <span className="font-mono">panel?action=stats</span>
              в карточке появятся цифры по Hy2-ноде. Если по ноде пусто — смотреть логи edge function
              <span className="font-mono"> panel</span> на ошибки <span className="font-mono">panelErrors</span>.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Готовые ноды</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Нода</TableHead>
                <TableHead>stats_port</TableHead>
                <TableHead>trafficStats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono">se.panelsu.ru</TableCell>
                <TableCell className="font-mono">7653</TableCell>
                <TableCell className="text-emerald-600">включено</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">czcdn / decdn / ficdn / rucdn</TableCell>
                <TableCell>—</TableCell>
                <TableCell className="text-muted-foreground">нужно включить по шагам выше</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function CascadeSection() {
  return (
    <>
      <PageHeader title="Каскад RU → exit" />
      <Card>
        <CardHeader>
          <CardTitle>Как настроено</CardTitle>
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
    </>
  );
}