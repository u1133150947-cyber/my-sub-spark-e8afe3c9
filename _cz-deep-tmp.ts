import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== actual xray config xhttpSettings ==='
jq '.inbounds[] | select(.streamSettings.network=="xhttp") | .streamSettings.xhttpSettings' /usr/local/x-ui/bin/config.json
echo
echo '=== enable xray loglevel debug temporarily? check current ==='
jq '.log' /usr/local/x-ui/bin/config.json
echo
echo '=== check listen/port ==='
ss -lntp | grep -E ':10444|xray'
echo
echo '=== try various paths ==='
for P in '/twcdn-xhttp' '/twcdn-xhttp/' '/twcdn-xhttp/abc'; do
  curl -sS -m 4 -H 'Host: cdn-origin.panelsu.ru' "http://127.0.0.1:10444\$P" -o /tmp/r -w "P=\$P -> %{http_code} body="
  cat /tmp/r; echo
done
echo
echo '=== xray version ==='
/usr/local/x-ui/bin/xray-linux-amd64 version 2>&1 | head -3
echo
echo '=== check stderr in service journal ==='
journalctl -u x-ui --no-pager -n 50 2>&1 | grep -iE 'xray|error|xhttp' | tail -30
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
