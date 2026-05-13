import { Client } from 'ssh2';
const c = new Client();
const cmd = `
DB=/opt/sub-manager/data/app.db
sqlite3 $DB ".schema inbound_overrides"
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
