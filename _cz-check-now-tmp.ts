import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== xray config (cdn-xhttp inbound) ==='
test -f /usr/local/etc/xray/config.json && jq '.inbounds[] | select(.tag=="cdn-xhttp")' /usr/local/etc/xray/config.json 2>/dev/null || echo NO_XRAY_CONFIG

echo
echo '=== xray outbounds ==='
jq '.outbounds' /usr/local/etc/xray/config.json 2>/dev/null || true

echo
echo '=== xray service ==='
systemctl is-active xray; systemctl status xray --no-pager -l 2>&1 | head -15

echo
echo '=== xray listening on 10444 ==='
ss -tlnp 2>/dev/null | grep -E ':(10444|443|10085)' || true

echo
echo '=== nginx vhost twcdn-xhttp ==='
grep -rl 'twcdn-xhttp' /etc/nginx/ 2>/dev/null | head -5
for f in \$(grep -rl 'twcdn-xhttp' /etc/nginx/ 2>/dev/null); do echo "--- \$f ---"; cat "\$f"; done

echo
echo '=== last 20 nginx access log lines ==='
tail -20 /var/log/nginx/access.log 2>/dev/null

echo
echo '=== last xray journal ==='
journalctl -u xray --no-pager -n 25 2>&1
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:',e.message);process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:8000});
