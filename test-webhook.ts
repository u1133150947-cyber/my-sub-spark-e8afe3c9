import { db } from "./server/db.ts";

async function main() {
  const czRes = await fetch("https://web.panelsu.ru/api/hy2/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addr: "1.2.3.4:5678", auth: "invalid-uuid" })
  });
  console.log("Invalid test:", await czRes.json());

  // Test with valid sub
  const valid = db.queryEntries("SELECT client_uuid FROM subscriptions LIMIT 1")[0] as any;
  if (valid) {
    const vRes = await fetch("https://web.panelsu.ru/api/hy2/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addr: "1.2.3.4:5678", auth: valid.client_uuid })
    });
    console.log("Valid test:", await vRes.json());
  }
}
main();
