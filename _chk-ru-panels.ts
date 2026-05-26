import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`sqlite3 /opt/sub-manager/data/app.db "SELECT slug,name,panel_url FROM panels;"`,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD!,readyTimeout:15000});
