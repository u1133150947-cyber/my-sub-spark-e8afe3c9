async function run() {
  const panel_url = "https://ru.panelsu.ru/";
  const username = "admin";
  const password = "6WYia!Y5gV5D";

  const loginRes = await fetch(panel_url + "login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password })
  });
  
  const cookies = loginRes.headers.get("set-cookie") || "";
  console.log("Logged in");

  const listRes = await fetch(panel_url + "panel/api/inbounds/list", {
    headers: { "Cookie": cookies, "Accept": "application/json" }
  });
  const listJson = await listRes.json();
  const h2ib = listJson.obj.find((x: any) => x.protocol === "hysteria");
  console.log("H2 Inbound ID:", h2ib.id);
  
  const settings = JSON.stringify({
    clients: [
      {
        id: "abc-123-def", email: "test_h2_addClient", enable: true,
        password: "abc-123-def"
      }
    ]
  });
  const addRes = await fetch(panel_url + "panel/api/inbounds/addClient", {
    method: "POST",
    headers: { "Cookie": cookies, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(h2ib.id), settings })
  });
  console.log("addClient response:", await addRes.text());

  // Also query it again to see what's in the DB settings
  const listRes2 = await fetch(panel_url + "panel/api/inbounds/list", {
    headers: { "Cookie": cookies, "Accept": "application/json" }
  });
  const listJson2 = await listRes2.json();
  const h2ib2 = listJson2.obj.find((x: any) => x.protocol === "hysteria");
  console.log("DB settings now:", h2ib2.settings);
}
run();
