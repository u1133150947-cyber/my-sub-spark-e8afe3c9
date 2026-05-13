import { Client } from 'ssh2';
const c = new Client();
const cmd = `
sed -i 's|reality.panelsu.ru.cer|fullchain.cer|' /etc/hysteria/config.yaml
grep cert /etc/hysteria/config.yaml
systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server

# self test
cat > /tmp/hcli.yaml <<'YAML'
server: reality.panelsu.ru:443
auth: TEST-KEY-REALITY-123
tls:
  sni: reality.panelsu.ru
socks5:
  listen: 127.0.0.1:11080
YAML
timeout 8 hysteria client -c /tmp/hcli.yaml &
P=$!
sleep 3
echo '=== curl via H2 ==='
curl -s --max-time 5 --socks5 127.0.0.1:11080 -4 https://ifconfig.me; echo
kill $P 2>/dev/null
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
