import { Client } from 'ssh2';
const c = new Client();
const yaml = `listen: :443

tls:
  cert: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.cer
  key: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key

auth:
  type: http
  http:
    url: https://web.panelsu.ru/api/hy2/auth
    insecure: false

masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
`;
const cmd = `
cp /etc/hysteria/config.yaml /etc/hysteria/config.yaml.bak.$(date +%s)
cat > /etc/hysteria/config.yaml <<'YAML'
${yaml}YAML
systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server
echo '--- config ---'; cat /etc/hysteria/config.yaml
echo '--- logs ---'; journalctl -u hysteria-server -n 15 --no-pager
echo '--- direct ip ---'; curl -s --max-time 5 -4 ifconfig.me; echo
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
