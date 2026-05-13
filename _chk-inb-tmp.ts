import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
sqlite3 /opt/sub-manager/data/app.db <<SQL
.headers on
.mode column
SELECT slug, name, panel_url FROM panels;
SELECT subscription_id, panel, inbound_id, remark, protocol, port, host FROM subscription_inbounds WHERE subscription_id='7ecaa558-e0b0-499d-8b07-6466f96bee24';
SQL
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
