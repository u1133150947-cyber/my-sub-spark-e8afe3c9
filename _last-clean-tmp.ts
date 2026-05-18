import { Client } from 'ssh2';
const cmd = `
set -e
rm -f /tmp/*.sh /tmp/*.py /tmp/*.ts /tmp/*.js /tmp/*.json /tmp/*.log /tmp/*.txt
ls /tmp/ 2>/dev/null | head -10
echo 'Cleanup complete'
`;
const hosts = [
  { name: 'RU', host: '82.202.128.147', pw: 'K!E2QAGrxYFx' },
  { name: 'CZ', host: '185.87.148.138', pw: 'hf6Ka8viMl' },
];
for (const h of hosts) {
  await new Promise<void>((res) => {
    const c = new Client();
    console.log(`\n############## ${h.name} ##############`);
    c.on('ready', () => c.exec(cmd, (e, s) => {
      s.on('close', () => { c.end(); res(); })
       .on('data', d => process.stdout.write(d.toString()))
       .stderr.on('data', d => process.stderr.write(d.toString()));
    })).on('error', e => { console.error(e.message); res(); })
    .connect({ host: h.host, port: 22, username: 'root', password: h.pw, readyTimeout: 15000 });
  });
}
