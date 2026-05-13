import { Client } from 'ssh2';

const remote = String.raw`cd /opt/sub-manager && cat > .standalone-save-test-tmp.ts <<'DENO'
import { db, uid } from './server/db.ts';

const token = 'test_' + crypto.randomUUID();
const subId = uid();
const slug = 'tmp' + crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const clientUuid = crypto.randomUUID();
const clientEmail = 'tmp_save_' + slug.slice(0, 6);
const expires = new Date(Date.now() + 10 * 60_000).toISOString();
let insertedServer = false;

try {
  const srv = db.queryEntries("SELECT id FROM standalone_servers WHERE id = 'cz' LIMIT 1")[0];
  if (!srv) {
    db.query("INSERT INTO standalone_servers (id, name, host, port) VALUES (?, ?, ?, ?)", ['cz', 'CZ Test', 'reality.panelsu.ru', 443]);
    insertedServer = true;
  }
  db.query("INSERT INTO admin_sessions (id, token, expires_at) VALUES (?, ?, ?)", [uid(), token, expires]);
  db.query("INSERT INTO subscriptions (id, slug, name, client_email, client_uuid, expiry_ms, total_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)", [subId, slug, 'TmpSaveStandalone', clientEmail, clientUuid, 0, 0]);

  const add = await fetch('http://127.0.0.1:8080/functions/v1/panel?action=addInbounds', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ id: subId, selections: [{ panel: 'standalone', inboundId: 1001 }] }),
  });
  const addJson = await add.json();
  const afterAdd = db.queryEntries("SELECT panel, inbound_id, protocol, client_email FROM subscription_inbounds WHERE subscription_id = ?", [subId]);

  const rem = await fetch('http://127.0.0.1:8080/functions/v1/panel?action=removeInbound', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ id: subId, panel: 'standalone', inboundId: 1001 }),
  });
  const remJson = await rem.json();
  const afterRemove = db.queryEntries("SELECT id FROM subscription_inbounds WHERE subscription_id = ?", [subId]);

  console.log(JSON.stringify({ addStatus: add.status, addJson, afterAdd, removeStatus: rem.status, remJson, afterRemoveCount: afterRemove.length }, null, 2));
  if (add.status !== 200 || !Array.isArray(addJson.created) || addJson.created.length !== 1 || afterAdd.length !== 1 || rem.status !== 200 || afterRemove.length !== 0) {
    Deno.exit(1);
  }
} finally {
  db.query("DELETE FROM subscription_inbounds WHERE subscription_id = ?", [subId]);
  db.query("DELETE FROM subscriptions WHERE id = ?", [subId]);
  db.query("DELETE FROM admin_sessions WHERE token = ?", [token]);
  if (insertedServer) db.query("DELETE FROM standalone_servers WHERE id = 'cz'");
}
DENO
deno run -A --unstable-kv .standalone-save-test-tmp.ts; rc=$?; rm -f .standalone-save-test-tmp.ts; exit $rc`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(remote, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code: number) => { conn.end(); if (code) process.exitCode = code; })
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
