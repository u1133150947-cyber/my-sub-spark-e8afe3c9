import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
sleep 5
echo '=== xray status ==='
systemctl is-active x-ui
ps -ef | grep xray | grep -v grep | head -3
echo '=== all TCP listeners ==='
ss -lntp 2>/dev/null
echo '=== xray error log ==='
tail -50 /usr/local/x-ui/bin/error.log 2>/dev/null
journalctl -u x-ui -n 30 --no-pager
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
