import { listInbounds } from "./server/x3ui";
async function run() {
  const list = await listInbounds("ru");
  const h2 = list.find(x => x.protocol === "hysteria");
  console.log(JSON.stringify(h2, null, 2));
}
run();
