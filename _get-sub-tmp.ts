import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`sqlite3 /opt/sub-manager/data/app.db "SELECT id, client_uuid, slug FROM subscriptions WHERE expiry_ms > $(date +%s)000 OR expiry_ms = 0 LIMIT 3;" 2>&1`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
