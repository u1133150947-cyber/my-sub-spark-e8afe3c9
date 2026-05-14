import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
echo '=== caddy ==='; systemctl is-active caddy; journalctl -u caddy -n 30 --no-pager
echo '=== caddyfile ==='; cat /etc/caddy/Caddyfile 2>/dev/null | head -80
echo '=== local panel test ==='; curl -sk -o /dev/null -w 'http2053=%{http_code}\n' http://127.0.0.1:2053/
curl -sk -o /dev/null -w 'https_ru=%{http_code}\n' https://ru.panelsu.ru/
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
