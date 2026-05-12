import { Client } from 'ssh2';
const hosts = [
  { name: 'RU', host: '82.202.128.147', password: 'K!E2QAGrxYFx' },
  { name: 'CZ', host: '185.87.148.138', password: 'hf6Ka8viMl' }
];
const cmd = `
sqlite3 /etc/x-ui/x-ui.db "UPDATE inbounds SET settings = json_insert(settings, '$.version', 2) WHERE protocol='hysteria' AND json_extract(settings, '$.version') IS NULL;"
systemctl restart x-ui
sleep 2
systemctl is-active x-ui
`;
async function runOne(h: any) {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { console.error(err); conn.end(); resolve(); return; }
        stream.on('data', d => process.stdout.write(d)).on('close', () => { conn.end(); resolve(); });
      });
    }).connect({ host: h.host, port: 22, username: 'root', password: h.password });
  });
}
async function main() {
  for (const h of hosts) await runOne(h);
}
main();