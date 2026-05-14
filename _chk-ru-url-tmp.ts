import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
echo '=== caddyfile ==='; cat /etc/caddy/Caddyfile
echo '=== panel settings ==='; sqlite3 /etc/x-ui/x-ui.db "SELECT key,value FROM settings WHERE key IN ('webPort','webBasePath','webDomain','webCertFile','webKeyFile','subPort','subPath');"
echo '=== panel url from app db ==='; sqlite3 /opt/sub-manager/data/app.db "SELECT slug, panel_url FROM panels;"
echo '=== test panel via caddy ==='; curl -sk -o /dev/null -w '%{http_code} %{url_effective}\n' https://ru.panelsu.ru/
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
