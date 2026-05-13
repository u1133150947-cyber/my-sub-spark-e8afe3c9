import { Client } from 'ssh2';
function run(host:string,pass:string,cmd:string):Promise<string>{
  return new Promise((res,rej)=>{const c=new Client();let o='';
    c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);
      s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);
    })).on('error',rej).connect({host,port:22,username:'root',password:pass,readyTimeout:15000});});
}
const CZ='185.87.148.138', CZP='hf6Ka8viMl';

console.log('=== STOP & PURGE ===');
console.log(await run(CZ,CZP,`
systemctl stop hysteria-server 2>&1 | tail -3
systemctl disable hysteria-server 2>&1 | tail -3
which hysteria && hysteria version 2>&1 | head -3 || echo no-bin
rm -f /etc/systemd/system/hysteria-server.service /etc/systemd/system/hysteria-server@.service
rm -rf /etc/hysteria
systemctl daemon-reload
echo done-purge
`));

console.log('=== INSTALL FRESH ===');
console.log(await run(CZ,CZP,`
bash <(curl -fsSL https://get.hy2.sh/) 2>&1 | tail -20
which hysteria && hysteria version 2>&1 | head -5
`));

console.log('=== CONFIG ===');
console.log(await run(CZ,CZP,`
mkdir -p /etc/hysteria
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

masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
YAML
ls -la /root/.acme.sh/reality.panelsu.ru_ecc/ 2>&1 | head -10
echo --- start ---
systemctl enable hysteria-server 2>&1 | tail -2
systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server
echo --- logs ---
journalctl -u hysteria-server -n 25 --no-pager
echo --- port ---
ss -lunp | grep :443
`));
