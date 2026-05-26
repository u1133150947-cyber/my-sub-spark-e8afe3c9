import { Client } from 'ssh2';
const c=new Client();
const SCRIPT = String.raw`
set -e
echo '=== schema ==='
sqlite3 /etc/x-ui/x-ui.db ".schema inbounds"
`;
c.on('ready',()=>c.exec(SCRIPT,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
