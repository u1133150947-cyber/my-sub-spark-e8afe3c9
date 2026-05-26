import { Client } from 'ssh2';
import { randomBytes } from 'crypto';

const subs = [
  {uuid:"fb3c58ff-b30e-48ab-8dd4-fb0abb26d776", suffix:"alina"},
  {uuid:"b05ad639-4812-476f-a6a7-4625d9ee06ac", suffix:"Andrey"},
  {uuid:"cbd49eb8-a4af-4800-943c-68e8401b1eb3", suffix:"anton"},
  {uuid:"f1155bcf-bbf2-4f52-b2e2-2fe6185c7e74", suffix:"Dmitry"},
  {uuid:"513d27a8-fd5e-4a45-a467-2602a3bc591b", suffix:"Olya"},
  {uuid:"16b16b4b-ae36-4b89-a794-888fdaffc9b3", suffix:"Paul"},
  {uuid:"80c4aa5b-607f-4143-9dd1-aa8b12ec4195", suffix:"vern"},
  {uuid:"ebaa0619-c4a9-4bd0-9603-f66946e53c1e", suffix:"Yuri"},
];

const panels = [
  {code:'se', host:'87.121.105.143', pass:'f4OQrEBYUQnEmwkgqPnwDD'},
  {code:'fi', host:'31.76.77.237', pass:'LqWp4FK0EdcfkeYjw0UIHbS'},
  {code:'cz', host:'cz.panelsu.ru', pass:'hf6Ka8viMl'},
];

function ssh(p:any, cmd:string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { conn.end(); reject(err); return; }
        stream.on('close', () => { conn.end(); resolve(out); })
          .on('data', d => { out += d.toString(); })
          .stderr.on('data', d => { out += d.toString(); });
      });
    }).on('error', reject)
      .connect({ host: p.host, port: 22, username: 'root', password: p.pass, readyTimeout: 15000 });
  });
}

for (const p of panels) {
  console.log(`\n=== ${p.code.toUpperCase()} ===`);
  // Generate keys
  const keys = await ssh(p, '/usr/local/x-ui/bin/xray-linux-amd64 x25519');
  const priv = keys.match(/PrivateKey:\s*(\S+)/)?.[1];
  const pub = keys.match(/(?:Hash32|Password):\s*(\S+)/g)?.map(s => s.split(/\s+/)[1]);
  // Actually we need Hash32 line (last one)
  const hashLine = keys.split('\n').find(l => l.startsWith('Hash32:'));
  const pubKey = hashLine ? hashLine.split(/\s+/)[1] : '';
  const sid = randomBytes(8).toString('hex');
  console.log('priv:', priv, 'pub:', pubKey, 'sid:', sid);

  const clients = subs.map(s => ({
    id: s.uuid, email: `${s.suffix}_${p.code}_xh`, enable: true, expiryTime: 0,
    limitIp: 0, totalGB: 0, flow: "", subId: s.uuid.slice(0,16), tgId: "", reset: 0
  }));
  const settings = JSON.stringify({ clients, decryption: "none", fallbacks: [] });
  const streamSettings = JSON.stringify({
    network: "xhttp", security: "reality", externalProxy: [],
    realitySettings: {
      show: false, xver: 0, dest: "www.google.com:443",
      serverNames: ["www.google.com", "google.com"],
      privateKey: priv, publicKey: pubKey,
      minClient: "", maxClient: "", maxTimediff: 0, shortIds: [sid],
      settings: { publicKey: pubKey, fingerprint: "chrome", serverName: "", spiderX: "/" }
    },
    xhttpSettings: { path: `/${p.code}-xh`, host: "", mode: "auto" }
  });
  const sniffing = JSON.stringify({ enabled: false, destOverride: ["http","tls","quic"], metadataOnly: false, routeOnly: false });

  const sqlEscape = (s:string) => s.replace(/'/g, "''");
  const sql = `INSERT INTO inbounds (user_id, up, down, total, remark, enable, expiry_time, listen, port, protocol, settings, stream_settings, tag, sniffing) VALUES (1, 0, 0, 0, '🏳️ xHTTP', 1, 0, '', 8447, 'vless', '${sqlEscape(settings)}', '${sqlEscape(streamSettings)}', 'inbound-8447', '${sqlEscape(sniffing)}'); SELECT last_insert_rowid();`;

  const cmd = `cat > /tmp/add_inb.sql << 'SQL'
${sql}
SQL
sqlite3 /etc/x-ui/x-ui.db < /tmp/add_inb.sql && systemctl restart x-ui && sleep 4 && echo "---NEW INBOUNDS---" && sqlite3 /etc/x-ui/x-ui.db "SELECT id, port, protocol, remark
