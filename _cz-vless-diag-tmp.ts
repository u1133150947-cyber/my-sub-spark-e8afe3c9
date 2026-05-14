import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set +e
echo '=== UPTIME ==='; uptime
echo '=== TCP TUNING ==='; sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc net.core.rmem_max net.core.wmem_max net.ipv4.tcp_fastopen 2>/dev/null
echo '=== WARP STATUS ==='; warp-cli --accept-tos status 2>/dev/null
echo '=== DIRECT vs WARP latency ==='
for i in 1 2 3; do curl -o /dev/null -s -w "DIRECT %{time_connect}s/%{time_total}s\n" --max-time 8 https://www.cloudflare.com/cdn-cgi/trace; done
for i in 1 2 3; do curl -o /dev/null -s -w "WARP   %{time_connect}s/%{time_total}s\n" --max-time 10 -x socks5h://127.0.0.1:40000 https://www.cloudflare.com/cdn-cgi/trace; done
echo '=== PING from CZ ==='
ping -c 5 -W 2 1.1.1.1 | tail -3
ping -c 5 -W 2 youtube.com | tail -3
ping -c 5 -W 2 google.com | tail -3
echo '=== TRACEROUTE 1.1.1.1 ==='; traceroute -n -w 1 -q 1 1.1.1.1 2>/dev/null | head -15
echo '=== XRAY CONNECTIONS to 2080 ==='; ss -ant | grep -c ':2080'
echo '=== XRAY CPU/MEM ==='; ps aux | grep xray | grep -v grep
echo '=== INBOUND 2080 stream_settings ==='; sqlite3 /etc/x-ui/x-ui.db "SELECT stream_settings FROM inbounds WHERE port=2080;"
echo '=== OUTBOUND ROUTING (xray cfg) ==='; cat /usr/local/x-ui/bin/config.json 2>/dev/null | python3 -c "import sys,json;c=json.load(sys.stdin);print(json.dumps(c.get('outbounds'),indent=2));print('---ROUTING---');print(json.dumps(c.get('routing'),indent=2))" 2>/dev/null | head -120
echo '=== NIC errors/drops ==='; ip -s link | head -20
echo '=== nstat retrans ==='; nstat -az 2>/dev/null | grep -iE 'retrans|TCPLost|drop' | head
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){console.error(e);c.end();return}s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>console.error('SSH:',e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:60000,keepaliveInterval:5000});
