import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
echo '=== hysteria status ==='; systemctl is-active hysteria-server; systemctl status hysteria-server --no-pager | head -20
echo '=== current config ==='; cat /etc/hysteria/config.yaml
echo '=== UDP 443 listen ==='; ss -lunp | grep :443
echo '=== last 30 log lines ==='; journalctl -u hysteria-server -n 30 --no-pager
echo '=== warp ==='; systemctl is-active warp-svc 2>/dev/null; curl -s --max-time 5 --socks5 127.0.0.1:40000 -4 ifconfig.me; echo
echo '=== direct ip ==='; curl -s --max-time 5 -4 ifconfig.me; echo
echo '=== firewall ==='; nft list ruleset 2>/dev/null | grep -iE 'udp|443' | head -20
echo '=== hysteria version ==='; hysteria version 2>&1 | head -5
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
