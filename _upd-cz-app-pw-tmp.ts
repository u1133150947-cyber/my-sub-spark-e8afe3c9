import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
sqlite3 /opt/sub-manager/data/app.db "UPDATE panels SET password='Tz7\\$mQv2Lp8Wn4Rg!Hd' WHERE country='CZ';"
sqlite3 /opt/sub-manager/data/app.db "SELECT slug,name,panel_url,username,password FROM panels;"
systemctl restart sub-manager
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
