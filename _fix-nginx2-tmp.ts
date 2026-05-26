import { Client } from 'ssh2';
const pw = process.env.RU_SSH_PASSWORD!;
const CMD = `
set -e
cat > /etc/nginx/stream-sni.conf <<'NGX'
stream {
  map $ssl_preread_server_name $upstream_port {
    ya.ru   18443;
    default 18443;
  }
  server {
    listen 0.0.0.0:8443;
    proxy_pass 127.0.0.1:$upstream_port;
    ssl_preread on;
    proxy_timeout 300s;
  }
}
NGX
nginx -t && systemctl reload nginx && echo OK
ss -lntp 2>/dev/null | grep ':8443 '
`;
await new Promise<void>(r=>{const c=new Client();
 c.on('ready',()=>c.exec(CMD,(e,s)=>{if(e){console.error(e);r();return}
  s.on('close',()=>{c.end();r()}).on('data',(d:any)=>process.stdout.write(d)).stderr.on('data',(d:any)=>process.stderr.write(d))}))
 .on('error',(e:any)=>{console.error(e.message);r()})
 .connect({host:'ru.panelsu.ru',port:22,username:'root',password:pw,readyTimeout:15000});});
