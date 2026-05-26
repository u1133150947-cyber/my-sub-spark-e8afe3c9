import { Client } from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`journalctl -xeu nginx.service --no-pager | tail -30; echo ===; nginx -t 2>&1; echo ===; ss -lntp | grep -E ':(80|443|8443|2053) '`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
