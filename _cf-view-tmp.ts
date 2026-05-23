import { Client } from 'ssh2';
const c = new Client();
const sh = `cat /etc/nginx/sites-enabled/xhttp-cdn.conf; echo; echo '=== port 80 ==='; ss -tlnp | grep :80`;
c.on('ready',()=>c.exec(sh,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
