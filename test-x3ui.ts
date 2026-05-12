import { panelFetch, listInbounds } from "./server/x3ui.ts";

// Mock the getPanelBySlug to avoid DB calls
import * as x3ui from "./server/x3ui.ts";
// @ts-ignore
x3ui.getPanelBySlug = function(slug: string) {
  return { 
    id: "1562ceb4", slug: "ru", name: "RU", 
    panel_url: "https://ru.panelsu.ru/", 
    username: "admin", password: "6WYia!Y5gV5D" 
  };
};

async function run() {
  try {
    const inbounds = await listInbounds("ru");
    const h2ib = inbounds.find(x => x.protocol === "hysteria");
    console.log("Found inbound:", h2ib.id, h2ib.protocol);

    // Try standard addClient
    const settings = JSON.stringify({
      clients: [
        {
          id: "abc-123-def", email: "test_h2_addClient", enable: true,
          password: "abc-123-def"
        }
      ]
    });
    const res = await panelFetch("ru", "/panel/api/inbounds/addClient", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id: String(h2ib.id), settings }).toString()
    });
    console.log("addClient response:", res.body);
  } catch (e) {
    console.error(e);
  }
}
run();
