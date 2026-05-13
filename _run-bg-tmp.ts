import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`cd /opt/sub-manager && nohup bash -c 'DB_PATH=/opt/sub-manager/data/app.db /usr/local/bin/deno run -A --unstable-kv --env=/opt/sub-manager/.env _add-cz.ts > /tmp/addcz.log 2>&1' &
sleep 1; echo started`,
(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
