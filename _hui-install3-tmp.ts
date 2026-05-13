import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
export TERM=xterm
nohup bash -c "printf '1\n1\n' | bash /tmp/hui.sh" > /tmp/hui-install2.log 2>&1 < /dev/null &
echo started=$!
sleep 90
echo '--- log ---'
tail -80 /tmp/hui-install2.log
echo '--- service ---'
systemctl is-active h-ui; systemctl status h-ui --no-pager 2>&1 | head -15
echo '--- ports ---'
ss -lntup | egrep ':(443|8081|8080|36963)'
echo '--- h-ui cli ---'
which h-ui && h-ui status 2>&1 | head -25
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
