import { db } from "./db.ts";
import { addInbound } from "./x3ui.ts";

export async function handleTestInbounds(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  
  const log: string[] = [];
  const push = (s: string) => { log.push(s); console.log("[test-inbounds]", s); };
  
  try {
    const panels = db.queryEntries("SELECT slug, id FROM panels") as any[];
    if (!panels.length) {
      throw new Error("Нет добавленных панелей для теста");
    }

    const numInbounds = 25;
    push(`Создаем ${numInbounds} тестовых inbounds на каждой панели...`);

    let successCount = 0;

    for (const p of panels) {
      push(`\n=== Панель: ${p.slug} ===`);
      for (let i = 1; i <= numInbounds; i++) {
        const port = 30000 + i;
        try {
          await addInbound(p.slug, {
            up: 0,
            down: 0,
            total: 0,
            remark: `Test_Inbound_${i}`,
            enable: true,
            expiryTime: 0,
            listen: "",
            port,
            protocol: "vless",
            settings: JSON.stringify({
              clients: [],
              decryption: "none",
              fallbacks: []
            }),
            streamSettings: JSON.stringify({
              network: "tcp",
              security: "none",
              tcpSettings: {
                acceptProxyProtocol: false,
                header: { type: "none" }
              }
            }),
            sniffing: JSON.stringify({
              enabled: true,
              destOverride: ["http", "tls", "quic"],
              metadataOnly: false,
              routeOnly: false
            })
          });
          push(`[+] Создан inbound ${i} (vless, порт: ${port})`);
          successCount++;
        } catch (e: any) {
          push(`[-] Ошибка создания inbound ${i} на ${p.slug}: ${e.message}`);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, successCount, log }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, log }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}