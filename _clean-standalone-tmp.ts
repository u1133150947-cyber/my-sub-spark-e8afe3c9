import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
systemctl stop sub-manager
sleep 1
sqlite3 /opt/sub-manager/data/app.db "DELETE FROM standalone_servers; SELECT changes() AS deleted;"
sqlite3 /opt/sub-manager/data/app.db "SELECT 'remaining=' || COUNT(*) FROM standalone_servers;"
systemctl start sub-manager
sleep 2
systemctl is-active sub-manager
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
