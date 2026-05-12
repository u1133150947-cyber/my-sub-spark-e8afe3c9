import { Client } from 'ssh2';
const hosts = [
  { name: 'RU', host: '82.202.128.147', password: 'K!E2QAGrxYFx' },
  { name: 'CZ', host: '185.87.148.138', password: 'hf6Ka8viMl' },
];
const cmd = `set -e
printf '== disable hysteria2 inbounds ==\n'
sqlite3 /etc/x-ui/x-ui.db "UPDATE inbounds SET enable=0 WHERE protocol IN ('hysteria2','hy2','hysteria'); SELECT id,remark,protocol,port,enable FROM inbounds ORDER BY id;"
systemctl restart x-ui
sleep 4
printf '\n== x-ui status ==\n'
systemctl is-active x-ui || true
printf '\n== listening ==\n'
ss -lntup | egrep '(:8443|:4430|:2080|:44433|:2053|:35978|:443 )' || true
printf '\n== recent x-ui errors ==\n'
journalctl -u x-ui -n 30 --no-pager | tail -30`;
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
