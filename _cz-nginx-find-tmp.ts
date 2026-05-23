import { Client } from 'ssh2';
const c = new Client();
const cmd = `
ls /etc/nginx/ 2>/dev/null || echo "no /etc/nginx"
which nginx
nginx -V 2>&1 | head -3
dpkg -l | grep -i nginx 2>/dev/null
find / -name "nginx.conf" 2>/dev/null | head -5
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
