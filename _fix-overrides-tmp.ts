import { Client } from 'ssh2';
const c = new Client();
const cmd = `
DB=/opt/sub-manager/data/app.db
sqlite3 $DB "UPDATE inbound_overrides SET label='🇨🇿 ⚡Чехия', updated_at=datetime('now') WHERE id='94c412c4-0066-47c3-989e-e9eaa2217499';"
sqlite3 $DB "UPDATE inbound_overrides SET label='🇷🇺 ⚡Россия', updated_at=datetime('now') WHERE id='afcef32c-f6e2-41b7-a152-bb1ed107e9e1';"
echo '=== after ==='
sqlite3 $DB "SELECT panel,inbound_id,label FROM inbound_overrides WHERE panel='standalone';"
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
