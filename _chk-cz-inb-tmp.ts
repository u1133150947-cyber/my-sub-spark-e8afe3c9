import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
cd /opt/sub-manager && cat > _list-cz.ts <<'TS'
import { listInbounds } from "./server/x3ui.ts";
const ibs = await listInbounds("pd4e485d3c9");
for (const i of ibs) console.log(i.id, i.protocol, i.port, i.remark, "enable=", i.enable);
TS
DB_PATH=/opt/sub-manager/data/app.db /usr/local/bin/deno run -A --unstable-kv --env=/opt/sub-manager/.env _list-cz.ts
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
