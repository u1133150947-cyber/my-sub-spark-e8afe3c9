import { Client } from 'ssh2';
import { readFileSync } from 'fs';
const sh = readFileSync('/tmp/restart-check.sh','utf-8');
const c = new Client();
c.on('ready',()=>c.exec(sh,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD!,readyTimeout:15000});
