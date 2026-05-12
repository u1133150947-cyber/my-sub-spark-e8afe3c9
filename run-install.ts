import { handleInstall } from "./server/install.ts";

const req = new Request("http://localhost/api/install-panel", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    host: "62.217.181.79",
    ssh_port: 22,
    ssh_user: "root",
    ssh_auth: "password",
    ssh_password: "6WYia!Y5gV5D",
    mode: "domain",
    domain: "3xru.panelsu.ru",
    panel_port: 2053,
    panel_path: "abc12345",
    panel_username: "admin",
    panel_password: "6WYia!Y5gV5D",
    save: true,
    name: "3xru.panelsu.ru",
    country: "RU",
  }),
});

handleInstall(req, new URL(req.url)).then(async (res) => {
  console.log("STATUS:", res.status);
  console.log("BODY:", await res.text());
});
