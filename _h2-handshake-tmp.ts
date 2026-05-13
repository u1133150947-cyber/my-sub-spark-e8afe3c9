import { Client } from 'ssh2';
const c = new Client();
const cfg = `server: reality.panelsu.ru:443
auth: TEST-KEY-REALITY-123
tls:
  sni: reality.panelsu.ru
  insecure: false
socks5:
  listen: 127.0.0.1:11080
`;
const cmd = `
cat > /tmp/hcli.yaml <<'YAML'
${cfg}YAML
timeout 8 hysteria client -c /tmp/hcli.yaml &
P=$!
sleep 3
echo '=== curl through hy2 client ==='
curl -s --max-time 5 --socks5 127.0.0.1:11080 -4 https://ifconfig.me; echo
kill $P 2>/dev/null
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
