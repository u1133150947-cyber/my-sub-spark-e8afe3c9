import { Client } from 'ssh2';
const UUID = '16b16b4b-ae36-4b89-a794-888fdaffc9b3';
const c = new Client();
const cmd = `
set +e
echo "=== build client config ==="
printf 'server: reality.panelsu.ru:443\\nauth: ${UUID}\\ntls:\\n  sni: reality.panelsu.ru\\n  insecure: false\\nsocks5:\\n  listen: 127.0.0.1:11080\\n' > /tmp/hy2c.yaml
cat /tmp/hy2c.yaml
pkill -f "hysteria client" 2>/dev/null; sleep 1
nohup hysteria client -c /tmp/hy2c.yaml > /tmp/hy2c.log 2>&1 &
sleep 4
echo "=== client log ==="
cat /tmp/hy2c.log
echo "=== curl through socks (ifconfig) ==="
curl -sS --max-time 20 --socks5 127.0.0.1:11080 -4 https://ifconfig.me; echo " <-exit:$?"
echo "=== curl google 204 ==="
curl -sS --max-time 20 --socks5 127.0.0.1:11080 https://www.google.com/generate_204 -o /dev/null -w "code:%{http_code} time:%{time_total}\\n"
echo "=== curl youtube ==="
curl -sS --max-time 20 --socks5 127.0.0.1:11080 https://www.youtube.com/ -o /dev/null -w "code:%{http_code} time:%{time_total}\\n"
echo "=== client log tail ==="
tail -40 /tmp/hy2c.log
pkill -f "hysteria client" 2>/dev/null
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
