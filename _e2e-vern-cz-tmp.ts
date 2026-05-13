import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host,port:22,username:'root',password:pw,readyTimeout:15000});});}

// Use RU server as a "third party client" to handshake to CZ Hysteria2
const VERN_UUID='80c4aa5b-607f-4143-9dd1-aa8b12ec4195';
const cmd = `set +e
which hysteria || curl -fsSL https://github.com/apernet/hysteria/releases/download/app/v2.6.0/hysteria-linux-amd64 -o /usr/local/bin/hysteria && chmod +x /usr/local/bin/hysteria
cat > /tmp/h2c.yaml <<YAML
server: reality.panelsu.ru:443
auth: ${VERN_UUID}
tls:
  sni: reality.panelsu.ru
  insecure: false
socks5:
  listen: 127.0.0.1:11801
YAML
hysteria client -c /tmp/h2c.yaml > /tmp/h2c.log 2>&1 &
P=$!
for i in 1 2 3 4 5 6 7 8 9 10; do ss -lnt 2>/dev/null | grep -q ':11801' && break; sleep 1; done
echo '--- ipify (should show CZ IP 185.87.148.138) ---'
curl -sS --max-time 12 --socks5-hostname 127.0.0.1:11801 https://api.ipify.org; echo
echo '--- generate_204 ---'
curl -sS -o /dev/null -w 'http=%{http_code} time=%{time_total}\n' --max-time 12 --socks5-hostname 127.0.0.1:11801 https://www.gstatic.com/generate_204
echo '--- hysteria client log tail ---'
tail -20 /tmp/h2c.log
kill $P 2>/dev/null
`;
console.log(await ssh('82.202.128.147','K!E2QAGrxYFx',cmd));
