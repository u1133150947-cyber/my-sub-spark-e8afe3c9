import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo "=== client log full ==="
cat /tmp/hy2c.log 2>&1
echo "=== ports ==="
ss -lntp | grep 11080
echo "=== quick test ==="
timeout 12 curl -sS --max-time 10 --socks5 127.0.0.1:11080 -4 https://1.1.1.1/cdn-cgi/trace 2>&1 | head -20
echo "exit:$?"
pkill -f "hysteria client" 2>/dev/null
`;
const cn = new Client();
cn.on('ready',()=>cn.exec(cmd,(e,s)=>{s.on('close',()=>cn.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
