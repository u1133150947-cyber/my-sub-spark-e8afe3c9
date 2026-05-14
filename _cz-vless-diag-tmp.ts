import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set +e
echo '=== UPTIME / LOAD ==='; uptime
echo '=== CPU ==='; top -bn1 | head -15
echo '=== MEM ==='; free -h
echo '=== NET INTERFACE ==='; ip -s link show $(ip route | awk '/default/ {print $5; exit}')
echo '=== TCP CONGESTION / BBR ==='; sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc net.ipv4.tcp_fastopen net.core.rmem_max net.core.wmem_max
echo '=== QUEUE/QDISC ==='; tc qdisc show
echo '=== WARP STATUS ==='; warp-cli --accept-tos status 2>/dev/null; warp-cli --accept-tos settings 2>/dev/null | head -20
echo '=== WARP SOCKS LATENCY ==='; for i in 1 2 3; do curl -o /dev/null -s -w "warp: %{time_connect} connect, %{time_total} total\n" --max-time 10 -x socks5h://127.0.0.1:40000 https://www.cloudflare.com/cdn-cgi/trace; done
echo '=== DIRECT LATENCY ==='; for i in 1 2 3; do curl -o /dev/null -s -w "direct: %{time_connect} connect, %{time_total} total\n" --max-time 10 https://www.cloudflare.com/cdn-cgi/trace; done
echo '=== PING TO POPULAR ==='; ping -c 4 -W 2 1.1.1.1; ping -c 4 -W 2 8.8.8.8; ping -c 4 -W 2 youtube.com
echo '=== MTR TO 1.1.1.1 ==='; mtr -rwc 5 1.1.1.1 2>/dev/null || traceroute -n -w 1 -q 1 1.1.1.1 | head -15
echo '=== XRAY/X-UI CPU ==='; ps aux | grep -E 'xray|x-ui' | grep -v grep
echo '=== PORT 2080 LISTEN + CONN COUNT ==='; ss -lntp | grep 2080; ss -ant | grep ':2080' | wc -l
echo '=== VLESS INBOUND 2080 STREAM ==='; sqlite3 /etc/x-ui/x-ui.db "SELECT remark,port,protocol,stream_settings FROM inbounds WHERE port=2080;" | head -c 2000
echo '=== PACKET LOSS / RETRANS ==='; nstat -az | grep -iE 'retrans|drop|err|loss' | head -20
echo '=== OUTBOUND ROUTING IN XRAY CONFIG ==='; cat /usr/local/x-ui/bin/config.json 2>/dev/null | python3 -c "import sys,json; c=json.load(sys.stdin); print(json.dumps({'outbounds':c.get('outbounds'),'routing':c.get('routing')},indent=2))" 2>/dev/null | head -100
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:15000});
