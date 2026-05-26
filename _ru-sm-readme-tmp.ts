import { Client } from 'ssh2';
const c = new Client();
const script = `
echo '=== README ==='
cat /opt/sub-manager/README.md 2>/dev/null | head -120
echo '=== install.sh ==='
cat /opt/sub-manager/install.sh 2>/dev/null
echo '=== systemd unit ==='
cat /etc/systemd/system/sub-manager.service 2>/dev/null
echo '=== .env (KEYS only, no values) ==='
grep -E '^[A-Z]' /opt/sub-manager/.env 2>/dev/null | sed 's/=.*//'
echo '=== caddyfile ==='
cat /etc/caddy/Caddyfile 2>/dev/null
echo '=== server entry ==='
ls /opt/sub-manager/server/ 2>/dev/null | head -20
echo '=== deno version ==='
/usr/local/bin/deno --version 2>&1 | head -3
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write('E: '+d.toString()));
})).on('error',e=>console.error('ERR',e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD,readyTimeout:20000});