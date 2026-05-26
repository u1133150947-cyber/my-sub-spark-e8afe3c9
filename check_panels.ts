import { Client } from 'ssh2';
const panels = [
  {name:'SE', host:'87.121.105.143', pass:'f4OQrEBYUQnEmwkgqPnwDD'},
  {name:'FI', host:'31.76.77.237', pass:'LqWp4FK0EdcfkeYjw0UIHbS'},
  {name:'CZ', host:'cz.panelsu.ru', pass:'hf6Ka8viMl'},
];
async function check(p:any) {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec('echo "===' + p.name + '==="; /usr/local/x-ui/x-ui -v 2>&1 | head -3; /usr/local/x-ui/bin/xray-linux-amd64 version 2>&1 | head -1; sqlite3 /etc/x-ui/x-ui.db "SELECT id, port, protocol, remark FROM inbounds;" 2>&1; echo "PORTS:"; ss -tlnp | grep -oE ":[0-9]+ " | sort -u | head -20', (err, stream) => {
        if(err){console.error(p.name,err); conn.end(); resolve(); return;}
        stream.on('close',()=>{conn.end();resolve();})
          .on('data', d => process.stdout.write(d.toString()))
          .stderr.on('data', d => process.stderr.write(p.name+':'+d.toString()));
      });
    }).on('error', e => { console.error(p.name, 'ERR', e.message); resolve(); })
      .connect({ host: p.host, port: 22, username: 'root', password: p.pass, readyTimeout: 15000 });
  });
}
for (const p of panels) await check(p);
