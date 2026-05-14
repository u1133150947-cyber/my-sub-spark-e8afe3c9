import { Client } from 'ssh2';
const c = new Client();
const script = String.raw`
set -e
systemctl stop sub-manager
sleep 1
cd /opt/sub-manager
DB_PATH=/opt/sub-manager/data/app.db /usr/local/bin/deno run -A --unstable-kv --env=/opt/sub-manager/.env _add-cz-all.ts
RC=$?
systemctl start sub-manager
sleep 2
systemctl is-active sub-manager
exit $RC
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));
})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:30000});
