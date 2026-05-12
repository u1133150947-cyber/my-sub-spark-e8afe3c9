import { Client } from 'ssh2';
const hosts = [ { name: 'CZ', host: '185.87.148.138', password: 'hf6Ka8viMl' } ];
const cmd = `sqlite3 /etc/x-ui/x-ui.db "SELECT remark, protocol, stream_settings FROM inbounds WHERE protocol LIKE 'hysteria%';"`;
async function runOne(h: any) {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => conn.exec(cmd, (err, stream) => {
      if (err) { console.error(err); conn.end(); resolve(); return; }
      stream.on('close', () => { conn.end(); resolve(); }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
    })).on('error', e => { console.error('SSH error', h.name, e.message); resolve(); })
      .connect({ host: h.host, port: 22, username: 'root', password: h.password });
  });
}
for (const h of hosts) await runOne(h);
