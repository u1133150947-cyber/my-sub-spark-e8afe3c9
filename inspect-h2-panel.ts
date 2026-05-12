import { listInbounds } from "./server/x3ui.ts";
async function run() {
  const list = await listInbounds("ru");
  const h2 = list.find((x: any) => x.protocol === "hysteria");
  console.log(JSON.stringify(h2, null, 2));
}
run();
