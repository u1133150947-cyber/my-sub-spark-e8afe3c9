import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
echo '=== x-ui settings ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT key,value FROM settings WHERE key IN ('webPort','webBasePath','webDomain','webCertFile','webKeyFile');"
echo '=== users ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT username FROM users;"
echo '=== caddy ==='
cat /etc/caddy/Caddyfile 2>/dev/null
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
