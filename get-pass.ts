import { db } from "./server/db.ts";
import { decryptField } from "./server/crypto.ts";

async function main() {
  const cz = db.queryEntries("SELECT host, password FROM panels WHERE name LIKE '%CZ%'")[0] as any;
  const ru = db.queryEntries("SELECT host, password FROM panels WHERE name LIKE '%RU%'")[0] as any;
  console.log("CZ:", cz.host, await decryptField(cz.password));
  console.log("RU:", ru.host, await decryptField(ru.password));
}
main();
