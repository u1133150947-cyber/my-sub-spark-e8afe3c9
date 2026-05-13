import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
echo '--- install log tail ---'
tail -50 /tmp/hui-install.log
echo '--- pid alive? ---'
ps -p 147918 2>&1 | tail -2
echo '--- service ---'
systemctl is-active h-ui 2>&1
which h-ui
echo '--- ports ---'
ss -lntup | egrep ':(443|8081|36963|8080)'
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
