import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
export PATH=/usr/local/bin:$PATH
cd /opt/sub-manager
echo '=== bun install ==='
bun install 2>&1 | tail -25
echo '=== bun run build ==='
bun run build 2>&1 | tail -20
echo '=== dist/ ==='
ls -la dist/ 2>/dev/null | head -10
echo '=== restart sub-manager ==='
systemctl reset-failed sub-manager
systemctl restart sub-manager
sleep 8
systemctl is-active sub-manager
echo '--- :8080 ---'
ss -tlnp 'sport = :8080' | tail -3
echo '--- last logs ---'
journalctl -u sub-manager -n 25 --no-pager | tail -30
echo '--- external https ---'
sleep 2
curl -skI --max-time 8 https://web2.panelsu.ru/ | head -10
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write('E:'+d));}))
.on('error',e=>console.error(e.message))
.connect({host:'150.241.70.207',username:'root',password:'MzXsgTR1v4026oAIe',readyTimeout:20000});