import {Client} from 'ssh2';
const TOKEN='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';
const c=new Client();
c.on('ready',()=>c.exec(`
ENV=/etc/sub-manager.env
touch $ENV
grep -v '^GITHUB_TOKEN=' $ENV > $ENV.tmp || true
echo 'GITHUB_TOKEN=${TOKEN}' >> $ENV.tmp
mv $ENV.tmp $ENV
chmod 600 $ENV
echo '--- env (token masked) ---'
sed 's/GITHUB_TOKEN=.*/GITHUB_TOKEN=***/' $ENV
systemctl restart sub-manager
sleep 2
systemctl is-active sub-manager
echo '--- version check ---'
curl -s http://127.0.0.1:8080/api/version | head -c 500
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
