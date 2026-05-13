import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
DB=/usr/local/h-ui/data/h_ui.db
echo '== tables =='
sqlite3 $DB ".tables"
echo '== schema account =='
sqlite3 $DB ".schema account"
echo '== schema config =='
sqlite3 $DB ".schema config"
echo '== current config =='
sqlite3 $DB "SELECT key,value FROM config;" 
echo '== current accounts =='
sqlite3 $DB "SELECT id,username,con_pass,quota,kick_util_enable,deleted FROM account;"
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
