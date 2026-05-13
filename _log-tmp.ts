import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`cat /tmp/addcz.log 2>/dev/null; echo "---"; sqlite3 /opt/sub-manager/data/app.db "SELECT panel, inbound_id, remark FROM subscription_inbounds WHERE subscription_id='7ecaa558-e0b0-499d-8b07-6466f96bee24';"`,
(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
