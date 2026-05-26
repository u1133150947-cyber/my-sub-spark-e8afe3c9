import { Client } from 'ssh2';
const c=new Client();
const SCRIPT = String.raw`
set -e
echo '=== check stream module file ==='
ls /usr/lib/nginx/modules/ 2>/dev/null | head -20
ls /etc/nginx/modules-enabled/ 2>/dev/null
apt-get install -y libnginx-mod-stream 2>&1 | tail -5
ls /etc/nginx/modules-enabled/
nginx -V 2>&1 | tr ' ' '\n' | grep -i stream

# Some distros build stream into nginx itself (no module file). Then 'load_module' fails.
# Try test without load
nginx -t 2>&1 | head -5

# If 'unknown directive stream' still — need to wrap differently. Use modules-enabled file:
cat /etc/nginx/modules-enabled/*stream* 2>/dev/null || echo "no stream module enabled"
`;
c.on('ready',()=>c.exec(SCRIPT,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
