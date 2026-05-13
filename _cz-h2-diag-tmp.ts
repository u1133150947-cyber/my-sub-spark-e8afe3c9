import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== status ==='; systemctl is-active hysteria-server
echo '=== last logs ==='; journalctl -u hysteria-server -n 40 --no-pager | tail -40
echo '=== udp 443 ==='; ss -lunp | grep :443
echo '=== test handshake locally (hy2 client) ==='
echo '=== curl masquerade ==='; curl -sk --max-time 6 https://127.0.0.1:443/ -o /dev/null -w '%{http_code}\n'
echo '=== check warp socks udp ==='; curl -s --max-time 5 --socks5 127.0.0.1:40000 -4 ifconfig.me; echo
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
