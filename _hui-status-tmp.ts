import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
systemctl is-active h-ui
systemctl status h-ui --no-pager 2>&1 | head -20
ss -lntup | egrep ':(443|8081|36963)'
ls /etc/h-ui 2>/dev/null
which h-ui && h-ui --help 2>&1 | head -30
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
