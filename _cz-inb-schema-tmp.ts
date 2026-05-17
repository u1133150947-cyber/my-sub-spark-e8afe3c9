import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
sqlite3 /etc/x-ui/x-ui.db <<'SQL'
.headers on
.mode line
SELECT sql FROM sqlite_master WHERE type='table' AND name='inbounds';
SELECT id,remark,port,protocol,enable,listen,tag FROM inbounds;
SQL
echo '--- one full row ---'
sqlite3 /etc/x-ui/x-ui.db "SELECT * FROM inbounds LIMIT 1;" | head -c 4000
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
