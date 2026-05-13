import { db } from "./server/db.ts";
import { decryptField } from "./server/crypto.ts";

async function main() {
  const all = db.queryEntries("SELECT host, public_host, password FROM panels");
  for (const p of all as any[]) {
    console.log(p.host || p.public_host, await decryptField(p.password));
  }
}
main();
