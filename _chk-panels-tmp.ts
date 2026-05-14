import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`sqlite3 /opt/sub-manager/data/app.db "SELECT slug,name,panel_url,username,password,host,public_host,country FROM panels;"`,
(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
