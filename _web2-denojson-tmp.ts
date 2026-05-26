import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
export PATH=/usr/local/bin:$PATH
cd /opt/sub-manager
echo '=== deno version ==='
deno --version | head -1
echo '=== write deno.json ==='
cat > deno.json <<'JSON'
{
  "nodeModulesDir": "auto"
}
JSON
cat deno.json
echo '=== deno cache server/main.ts (warm) ==='
timeout 120 deno cache --allow-import server/main.ts 2>&1 | tail -15
echo '=== restart ==='
systemctl reset-failed sub-manager
systemctl restart sub-manager
sleep 10
systemctl is-active sub-manager
echo '--- :8080 ---'
ss -tlnp 'sport = :8080' | tail -3
echo '--- last logs ---'
journalctl -u sub-manager -n 20 --no-pager | tail -25
echo '--- external https ---'
sleep 2
curl -skI --max-time 8 https://web2.panelsu.ru/ | head -8
echo '--- HTML ---'
curl -sk --max-time 8 https://web2.panelsu.ru/ | head -5
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write('E:'+d));}))
.on('error',e=>console.error(e.message))
.connect({host:'150.241.70.207',username:'root',password:'MzXsgTR1v4026oAIe',readyTimeout:20000});