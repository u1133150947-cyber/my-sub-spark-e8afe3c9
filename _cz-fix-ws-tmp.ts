import { Client } from 'ssh2';
const c = new Client();
const cmd = String.raw`
set +e
DB=/etc/x-ui/x-ui.db
UUID=1ad2264f-1e15-4f0b-b5aa-1acde945af9e

echo '=== schema ==='
sqlite3 $DB ".schema inbounds"

echo '=== existing inbound 23 full row ==='
sqlite3 $DB "SELECT * FROM inbounds WHERE id=23;"
echo
echo '=== columns ==='
sqlite3 $DB "PRAGMA table_info(inbounds);"
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('EXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:', e.message); process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
