import { Client } from 'ssh2';
const c = new Client();
const yaml = `listen: :443

tls:
  cert: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.cer
  key: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key

auth:
  type: password
  password: TEST-KEY-REALITY-123

masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true

outbounds:
  - name: warp
    type: socks5
    socks5:
      addr: 127.0.0.1:40000
  - name: direct
    type: direct

acl:
  inline:
    - warp(all)
`;
const cmd = `
cp /etc/hysteria/config.yaml /etc/hysteria/config.yaml.bak.$(date +%s)
cat > /etc/hysteria/config.yaml <<'YAML'
${yaml}YAML
systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server
journalctl -u hysteria-server -n 20 --no-pager | tail -20
echo '=== direct ==='; curl -s --max-time 5 -4 ifconfig.me; echo
echo '=== warp socks ==='; curl -s --max-time 8 --socks5 127.0.0.1:40000 -4 ifconfig.me; echo
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
