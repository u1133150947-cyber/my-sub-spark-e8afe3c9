import { Client } from 'ssh2';
const c=new Client();
const SCRIPT=String.raw`
set -e
echo '=== current inbounds ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,tag,listen,port,enable FROM inbounds;"
echo '=== xray cmd ==='
ps -ef | grep -E '[x]ray' | head -3
echo '=== running config ==='
ls /usr/local/x-ui/bin/
cat /usr/local/x-ui/bin/config.json 2>/dev/null | jq '.inbounds | map({tag,listen,port})' || true
echo '=== restart x-ui ==='
systemctl restart x-ui
sleep 5
ss -lntp | grep -E ':(8443|18443|18444|18445|18446) '
echo '=== xray error ==='
tail -30 /usr/local/x-ui/error.log 2>/dev/null
journalctl -u x-ui -n 20 --no-pager
`;
c.on('ready',()=>c.exec(SCRIPT,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
