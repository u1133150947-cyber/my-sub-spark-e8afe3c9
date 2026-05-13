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

acl:
  inline:
    - warp(all)
`;
const cmd = `
cat > /etc/hysteria/config.yaml <<'YAML'
${yaml}YAML
systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server
echo '=== logs after restart ==='
journalctl -u hysteria-server -n 10 --no-pager
echo '=== handshake test ==='
# install hysteria client locally for self-test
which hysteria || curl -fsSL https://app.hysteria.network/get.sh -o /tmp/h.sh
echo '=== quick UDP listen ==='; ss -lunp | grep :443
echo '=== firewall UDP 443 ==='; iptables -S INPUT 2>/dev/null | grep -E '443|DROP|REJECT' | head; nft list ruleset 2>/dev/null | grep -E '443|drop|reject' | head
echo '=== external UDP probe (from CZ to itself via public IP) ==='
nc -uvz -w 2 185.87.148.138 443 2>&1 | head
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
