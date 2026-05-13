import { Client } from 'ssh2';
const UUID = '16b16b4b-ae36-4b89-a794-888fdaffc9b3';
const c = new Client();
const cmd = [
  'echo "=== auth endpoint ==="',
  `curl -s -X POST https://web.panelsu.ru/api/hy2/auth -H 'content-type: application/json' -d '{"addr":"1.2.3.4:1234","auth":"${UUID}","tx":0}' --max-time 10`,
  'echo',
  'echo "=== invalid auth ==="',
  `curl -s -X POST https://web.panelsu.ru/api/hy2/auth -H 'content-type: application/json' -d '{"addr":"1.2.3.4:1234","auth":"INVALID","tx":0}' --max-time 10`,
  'echo',
  'echo "=== build hysteria client config ==="',
  `cat > /tmp/hy2c.yaml <<YAML
server: reality.panelsu.ru:443
auth: ${UUID}
tls:
  sni: reality.panelsu.ru
  insecure: false
socks5:
  listen: 127.0.0.1:11080
YAML`,
  'cat /tmp/hy2c.yaml',
  'echo "=== run client in bg ==="',
  'pkill -f "hysteria client" 2>/dev/null; sleep 1',
  'nohup hysteria client -c /tmp/hy2c.yaml > /tmp/hy2c.log 2>&1 &',
  'sleep 4',
  'echo "=== client log ==="',
  'cat /tmp/hy2c.log',
  'echo "=== test through socks ==="',
  'curl -s --max-time 15 --socks5 127.0.0.1:11080 -4 https://ifconfig.me; echo " <- exit:$?"',
  'curl -s --max-time 15 --socks5 127.0.0.1:11080 https://www.google.com/generate_204 -o /dev/null -w "google:%{http_code} time:%{time_total}\\n"',
  'echo "=== client log after ==="',
  'tail -30 /tmp/hy2c.log',
  'pkill -f "hysteria client" 2>/dev/null',
].join(' && ');
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
