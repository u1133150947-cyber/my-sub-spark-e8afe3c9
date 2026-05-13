import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`ls -la /tmp/addcz.log; cat /tmp/addcz.log; echo "---procs---"; ps aux | grep deno | grep -v grep`,
(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
