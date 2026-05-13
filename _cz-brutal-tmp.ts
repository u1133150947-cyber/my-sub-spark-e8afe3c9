import { Client } from 'ssh2';
function run(cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});});}
console.log(await run(`
cp /etc/hysteria/config.yaml /etc/hysteria/config.yaml.bak.brutal.$(date +%s)
cat > /etc/hysteria/config.yaml <<'YAML'
listen: :443

tls:
  cert: /root/.acme.sh/reality.panelsu.ru_ecc/fullchain.cer
  key: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key

auth:
  type: http
  http:
    url: https://web.panelsu.ru/api/hy2/auth
    insecure: false

bandwidth:
  up: 1 gbps
  down: 1 gbps

ignoreClientBandwidth: false

quic:
  initStreamReceiveWindow: 16777216
  maxStreamReceiveWindow: 33554432
  initConnReceiveWindow: 33554432
  maxConnReceiveWindow: 67108864
  maxIdleTimeout: 30s
  maxIncomingStreams: 1024
  disablePathMTUDiscovery: false

masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
YAML
systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server
echo --- logs ---
journalctl -u hysteria-server -n 12 --no-pager
echo --- udp 443 ---
ss -lunp | grep :443
`));
