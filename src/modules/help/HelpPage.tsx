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
    </div>
  );
}