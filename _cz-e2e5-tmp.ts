import { Client } from 'ssh2';
const UUID = '16b16b4b-ae36-4b89-a794-888fdaffc9b3';
const cmd = `
pkill -f "hysteria client" 2>/dev/null; sleep 1
printf 'server: reality.panelsu.ru:443\\nauth: ${UUID}\\ntls:\\n  sni: reality.panelsu.ru\\nsocks5:\\n  listen: 127.0.0.1:11080\\n' > /tmp/hy2c.yaml
setsid nohup hysteria client -c /tmp/hy2c.yaml </dev/null >/tmp/hy2c.log 2>&1 &
disown
sleep 5
echo "=== client log ==="
cat /tmp/hy2c.log
echo "=== port 11080 ==="
ss -lntp | grep 11080
echo "=== curl trace ==="
timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11080 https://1.1.1.1/cdn-cgi/trace 2>&1 | head -20
echo "exit:$?"
echo "=== curl youtube ==="
timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11080 https://www.youtube.com/ -o /dev/null -w "code:%{http_code} time:%{time_total}\\n"
echo "=== more log ==="
tail -30 /tmp/hy2c.log
pkill -f "hysteria client" 2>/dev/null
`;
const c = new Client();
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
