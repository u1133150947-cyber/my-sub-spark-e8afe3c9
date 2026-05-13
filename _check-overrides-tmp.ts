import { Client } from 'ssh2';
const c = new Client();
const cmd = `
DB=/opt/sub-manager/data/app.db
echo '=== tables ==='; sqlite3 $DB ".tables"
echo '=== overrides ==='; sqlite3 $DB "SELECT * FROM inbound_label_overrides;" 2>/dev/null || sqlite3 $DB "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%verri%' OR name LIKE '%label%';"
echo '=== try common names ==='
for t in label_overrides inbound_overrides overrides display_overrides; do
  echo "-- $t --"; sqlite3 $DB "SELECT * FROM $t;" 2>&1 | head -20
done
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
