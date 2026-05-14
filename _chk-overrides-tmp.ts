import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
sqlite3 /opt/sub-manager/data/app.db <<SQL
.headers on
.mode column
SELECT '--- inbound_overrides ---';
SELECT * FROM inbound_overrides;
SELECT '--- RU inbounds remark from panel ---';
SQL
sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,port,protocol,enable FROM inbounds;" 2>/dev/null
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
