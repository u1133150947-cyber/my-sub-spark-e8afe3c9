import { decryptField } from "./server/crypto.ts";

async function main() {
  const ruUrl = Deno.env.get("PANEL_RU_URL");
  const ruUser = Deno.env.get("PANEL_RU_USERNAME");
  const ruPass = Deno.env.get("PANEL_RU_PASSWORD");
  console.log({ ruUrl, ruUser: !!ruUser, ruPass: !!ruPass });
}
main();
