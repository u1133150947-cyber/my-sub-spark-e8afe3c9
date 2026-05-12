import { db, uid } from "./db.ts";
import { addClient, getPanelBySlug, uuidv4, randomSlug } from "./x3ui.ts";

export async function handleTestAccounts(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  
  const log: string[] = [];
  const push = (s: string) => { log.push(s); console.log("[test-accounts]", s); };
  
  try {
    const panels = db.queryEntries("SELECT slug, id FROM panels") as any[];
    if (!panels.length) {
      throw new Error("Нет добавленных панелей для теста");
    }

    const numTests = 10;
    push(`Создаем ${numTests} тестовых аккаунтов...`);

    let successCount = 0;

    for (let i = 1; i <= numTests; i++) {
      const slug = randomSlug(12);
      const name = `test_account_${i}`;
      const email = `test_email_${i}_${slug.slice(0,6)}`;
      const clientUuid = uuidv4();
      const expiryMs = 0;
      const totalBytes = 0;
      const subIdShort = randomSlug(16);
      const subId = uid();
      
      db.query(`INSERT INTO subscriptions (id, slug, name, client_email, client_uuid, expiry_ms, total_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [subId, slug, name, email, clientUuid, expiryMs, totalBytes]);
      
      for (const p of panels) {
        try {
          const panelSlug = p.slug;
          const ibId = 1;
          
          await addClient(panelSlug, ibId, {
            id: clientUuid,
            email: `${email}_${panelSlug}${ibId}`,
            expiryTime: expiryMs,
            totalGB: totalBytes,
            subId: subIdShort,
            flow: "xtls-rprx-vision"
          });

          db.query(`INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uid(), subId, panelSlug, ibId, `Test-${i}`, "vless", 12000, "test.host", "{}", `${email}_${panelSlug}${ibId}`]);

          push(`[+] Аккаунт ${i} добавлен на панель ${panelSlug} (inbound ${ibId})`);
          successCount++;
        } catch (e: any) {
          push(`[-] Ошибка на панели ${p.slug}: ${e.message}`);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, successCount, log }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, log }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}