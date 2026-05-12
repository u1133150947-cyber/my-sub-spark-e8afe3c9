import { db } from "./server/db.ts";
import { addClient, getPanelBySlug } from "./server/x3ui.ts";
import { uuidv4, randomSlug } from "./server/x3ui.ts";

async function main() {
  const panels = db.queryEntries("SELECT slug, id FROM panels") as any[];
  if (!panels.length) {
    console.error("Нет добавленных панелей для теста");
    return;
  }

  const numTests = 10;
  console.log(`Создаем ${numTests} тестовых аккаунтов...`);

  for (let i = 1; i <= numTests; i++) {
    const slug = randomSlug(12);
    const name = `test_account_${i}`;
    const email = `test_email_${i}_${slug.slice(0,6)}`;
    const clientUuid = uuidv4();
    const expiryMs = 0;
    const totalBytes = 0;
    const subIdShort = randomSlug(16);
    const subId = uuidv4();
    
    // Вставляем подписку
    db.query(`INSERT INTO subscriptions (id, slug, name, client_email, client_uuid, expiry_ms, total_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [subId, slug, name, email, clientUuid, expiryMs, totalBytes]);
    
    // Для каждой панели берем первый попавшийся inbound
    for (const p of panels) {
      try {
        const panelSlug = p.slug;
        const panelRow = getPanelBySlug(panelSlug);
        // Получаем inbounds (для теста просто берем первый или id=1)
        const ibId = 1; // Предполагаем, что inbound=1 существует на обоих серверах (Чехия и Россия)
        
        await addClient(panelSlug, ibId, {
          id: clientUuid,
          email: `${email}_${panelSlug}${ibId}`,
          expiryTime: expiryMs,
          totalGB: totalBytes,
          subId: subIdShort,
          flow: "xtls-rprx-vision"
        });

        db.query(`INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), subId, panelSlug, ibId, `Test-${i}`, "vless", 12000, "test.host", "{}", `${email}_${panelSlug}${ibId}`]);

        console.log(`[+] Аккаунт ${i} добавлен на панель ${panelSlug} (inbound ${ibId})`);
      } catch (e: any) {
        console.error(`[-] Ошибка на панели ${p.slug}: ${e.message}`);
      }
    }
  }
  console.log("Тестирование завершено. Проверьте панели 3X-UI!");
}

main().catch(console.error);
