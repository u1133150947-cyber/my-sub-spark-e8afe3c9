import { Client } from 'ssh2';
const c = new Client();
const cmd = `find / -name 'app.db' 2>/dev/null | head -5; echo '---'; ls -la /opt 2>/dev/null; ls -la /root/*/data 2>/dev/null`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
