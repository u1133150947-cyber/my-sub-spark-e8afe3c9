import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== CZ inbound 2080 stream_settings ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT stream_settings FROM inbounds WHERE port=2080;" | python3 -m json.tool 2>/dev/null
echo '=== CZ inbound 2080 settings (clients) ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT settings FROM inbounds WHERE port=2080;" | python3 -m json.tool 2>/dev/null
echo '=== port 2080 listening? ==='
ss -lntp | grep 2080
echo '=== TCP test from itself ==='
nc -zv 127.0.0.1 2080 2>&1 | head
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
