import { Client } from 'ssh2';
const hosts = [
  { name: 'RU', host: '82.202.128.147', password: 'K!E2QAGrxYFx' },
  { name: 'CZ', host: '185.87.148.138', password: 'hf6Ka8viMl' },
];
const cmd = `journalctl -u x-ui --no-pager | grep "unknown transport protocol" | tail -n 5`;
async function runOne(h: any) {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    console.log('\n########', h.name, h.host, '########');
    conn.on('ready', () => conn.exec(cmd, (err, stream) => {
      if (err) { console.error(err); conn.end(); resolve(); return; }
      stream.on('close', () => { conn.end(); resolve(); }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
    })).on('error', e => { console.error('SSH error', h.name, e.message); resolve(); })
      .connect({ host: h.host, port: 22, username: 'root', password: h.password });
  });
}
for (const h of hosts) await runOne(h);
