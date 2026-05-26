import { Client } from 'ssh2';
const pw = process.env.RU_SSH_PASSWORD!;
const CMD = `
set -e
cat > /etc/nginx/stream-sni.conf <<'NGX'
    ya.ru   18443;
    default 18443;
NGX
echo '--- new file ---'; cat /etc/nginx/stream-sni.conf
nginx -t && systemctl reload nginx && echo 'NGINX OK'
ss -lntp 2>/dev/null | grep -E ':8443 '
`;
await new Promise<void>(r=>{const c=new Client();
 c.on('ready',()=>c.exec(CMD,(e,s)=>{if(e){console.error(e);r();return}
  s.on('close',()=>{c.end();r()}).on('data',(d:any)=>process.stdout.write(d)).stderr.on('data',(d:any)=>process.stderr.write(d))}))
 .on('error',(e:any)=>{console.error(e.message);r()})
 .connect({host:'ru.panelsu.ru',port:22,username:'root',password:pw,readyTimeout:15000});});
