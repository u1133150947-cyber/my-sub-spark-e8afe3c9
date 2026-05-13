import { Client } from 'ssh2';
const c = new Client();
const cmd = `
DB=/opt/sub-manager/data/app.db
echo '=== which db active ==='; lsof 2>/dev/null | grep app.db | head -3
echo '=== H2/hysteria inbounds ==='
for d in /opt/sub-manager/data/app.db /root/data/app.db /root/3x-ui-sub-manager-update/data/app.db; do
  echo "-- $d --"
  sqlite3 $d "SELECT panel,inbound_id,remark,protocol,host,port,client_email,subscription_id FROM subscription_inbounds WHERE protocol LIKE 'hysteria%' OR protocol='hy2';" 2>/dev/null
done
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
