import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
echo '=== x-ui status ==='; systemctl is-active x-ui; systemctl status x-ui --no-pager | head -20
echo '=== x-ui version ==='; /usr/local/x-ui/x-ui version 2>&1 | head -5
echo '=== ports ==='; ss -lntp | egrep ':(8443|4430|2053|54321)'
echo '=== x-ui log ==='; journalctl -u x-ui -n 40 --no-pager
echo '=== xray log ==='; tail -30 /usr/local/x-ui/bin/*.log 2>/dev/null; tail -30 /var/log/xray/error.log 2>/dev/null
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
