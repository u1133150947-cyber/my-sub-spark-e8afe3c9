import { decryptField } from "./server/crypto.ts";

async function loginPanel(url: string, user: string, pass: string) {
  const username = await decryptField(user);
  const password = await decryptField(pass);
  const res = await fetch(`${url}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${text}`);
  const sc = res.headers.get("set-cookie");
  const cookie = (sc ?? "").split(",").map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
  return cookie;
}

async function listInbounds(url: string, cookie: string) {
  const r = await fetch(`${url}/panel/api/inbounds/list`, {
    headers: { Cookie: cookie, Accept: "application/json" }
  });
  return await r.json();
}

async function addClient(url: string, cookie: string, inboundId: number, c: any) {
  const settings = JSON.stringify({
    clients: [{ id: c.id, flow: c.flow ?? "", email: c.email, limitIp: 0, totalGB: c.totalGB, expiryTime: c.expiryTime, enable: true, tgId: "", subId: c.subId, reset: 0 }],
  });
  const res = await fetch(`${url}/panel/api/inbounds/addClient`, {
    method: "POST", 
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({ id: String(inboundId), settings }).toString(),
  });
  return await res.json();
}

async function main() {
  const ruUrl = Deno.env.get("PANEL_RU_URL")!;
  const ruUser = Deno.env.get("PANEL_RU_USERNAME")!;
  const ruPass = Deno.env.get("PANEL_RU_PASSWORD")!;
  
  const cookie = await loginPanel(ruUrl, ruUser, ruPass);
  console.log("Logged in!");
  
  const inbounds = await listInbounds(ruUrl, cookie);
  console.log("Inbounds:", inbounds.obj.length);
  const ibId = inbounds.obj[0].id;

  const testClient = {
    id: crypto.randomUUID(),
    email: "test_direct_api_lovable",
    expiryTime: 0,
    totalGB: 0,
    subId: "testlovable123",
    flow: "xtls-rprx-vision"
  };

  console.log("Adding client...", testClient.email);
  const result = await addClient(ruUrl, cookie, ibId, testClient);
  console.log("Add client result:", result);
}
main().catch(console.error);
