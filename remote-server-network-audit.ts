import { Client } from 'ssh2';
const hosts = [
  { name: 'RU', host: '82.202.128.147', password: 'K!E2QAGrxYFx' },
  { name: 'CZ', host: '185.87.148.138', password: 'hf6Ka8viMl' },
];
const cmd = `printf '== hostname ==\n'; hostname -f || hostname
printf '\n== services ==\n'; systemctl is-active x-ui || true; systemctl is-active xray || true; systemctl is-active caddy || true
printf '\n== listening ports ==\n'; ss -lntup | egrep '(:8443|:4430|:2080|:44433|:2053|:35978|:443 )' || true
printf '\n== firewall ==\n'; iptables -S INPUT 2>/dev/null | head -80 || true; nft list ruleset 2>/dev/null | head -120 || true
printf '\n== x-ui status ==\n'; (x-ui status || /usr/local/x-ui/x-ui status || true) 2>&1
printf '\n== x-ui logs ==\n'; journalctl -u x-ui -n 60 --no-pager || true
printf '\n== xray processes ==\n'; ps aux | egrep 'xray|x-ui' | grep -v grep || true
printf '\n== local port tcp checks ==\n'; for p in 8443 4430 2080 44433 2053 35978; do timeout 2 bash -c "</dev/tcp/127.0.0.1/$p" >/dev/null 2>&1 && echo OPEN 127.0.0.1:$p || echo CLOSED 127.0.0.1:$p; done`;
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
