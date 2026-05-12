import { getAllPanels, panelCfg } from "./server/x3ui.ts";
async function run() {
  const p = getAllPanels(true).find((x: any) => x.slug === "ru");
  const cfg = panelCfg(p);
  const loginRes = await fetch(`${cfg.url}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: cfg.username, password: cfg.password })
  });
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] || "";
  
  // get inbounds
  const listRes = await fetch(`${cfg.url}/panel/api/inbounds/list`, {
    headers: { "Cookie": cookie, "Accept": "application/json" }
  });
  const listJson = await listRes.json();
  const h2ib = listJson.obj.find((x: any) => x.protocol === "hysteria");
  
  console.log("Original inbound settings:", h2ib.settings);

  // try to add a client via the standard API
  const settings = JSON.stringify({
    clients: [
      {
        id: "abc-123", email: "test_3xui_api", enable: true,
        password: "abc-123"
      }
    ]
  });

  const addRes = await fetch(`${cfg.url}/panel/api/inbounds/addClient`, {
    method: "POST",
    headers: { "Cookie": cookie, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(h2ib.id), settings })
  });
  const addJson = await addRes.json();
  console.log("Add client response:", addJson);
}
run();
