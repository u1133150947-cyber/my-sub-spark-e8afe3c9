import { Client } from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`journalctl -xeu nginx.service --no-pager | tail -20; echo ===; cat /etc/nginx/sites-enabled/xui`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
