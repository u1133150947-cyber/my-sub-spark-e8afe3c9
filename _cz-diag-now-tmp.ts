import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set +e
echo '=== uptime / load ==='; uptime
echo; echo '=== CPU/mem top ==='; top -bn1 | head -20
echo; echo '=== xray / x-ui status ==='; systemctl is-active x-ui; ps aux | grep -E 'xray|x-ui' | grep -v grep | head
echo; echo '=== hysteria status ==='; systemctl is-active hysteria-server 2>/dev/null
echo; echo '=== warp ==='; systemctl is-active warp-svc 2>/dev/null; curl -s --max-time 5 -x socks5h://127.0.0.1:40000 https://www.cloudflare.com/cdn-cgi/trace 2>/dev/null | egrep 'ip=|warp=|colo='
echo; echo '=== listeners ==='; ss -lntup | egrep ':(443|2053|4430|8443|44433)' 
echo; echo '=== xray config outbounds/routing ==='; ls /usr/local/x-ui/bin/ 2>/dev/null; cat /usr/local/x-ui/bin/config.json 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);print('OUTBOUNDS:');[print(' -',o.get('tag'),o.get('protocol')) for o in d.get('outbounds',[])];print('ROUTING RULES:');[print(' -',r.get('outboundTag'),r.get('domain') or r.get('ip') or r.get('network')) for r in d.get('routing',{}).get('rules',[])]" 2>/dev/null
echo; echo '=== xray config from x-ui db settings ==='; sqlite3 /etc/x-ui/x-ui.db "SELECT key,value FROM settings WHERE key LIKE '%xray%' OR key LIKE '%template%';" 2>/dev/null | head -c 2000
echo; echo '=== ping 1.1.1.1 from CZ ==='; ping -c 5 -W 2 1.1.1.1 | tail -5
echo; echo '=== mtr 1.1.1.1 ==='; mtr -rwzc 5 1.1.1.1 2>/dev/null | head -25 || traceroute -n -w 2 -q 1 1.1.1.1 2>/dev/null | head -20
echo; echo '=== mtr youtube ==='; mtr -rwzc 5 youtube.com 2>/dev/null | head -25
echo; echo '=== net errors / drops ==='; ip -s link show | grep -A2 'state UP' | head -20
echo; echo '=== sysctl bbr/qdisc ==='; sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc
echo; echo '=== xray log tail ==='; tail -30 /usr/local/x-ui/bin/access.log 2>/dev/null; tail -30 /usr/local/x-ui/bin/error.log 2>/dev/null
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:15000});
