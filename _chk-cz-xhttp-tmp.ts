import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== xray version ==='
/usr/local/x-ui/bin/xray-linux-amd64 version 2>/dev/null | head -3 || xray version 2>/dev/null | head -3
echo
echo '=== nginx sites ==='
ls /etc/nginx/sites-enabled/ 2>/dev/null
ls /etc/nginx/conf.d/ 2>/dev/null
echo
echo '=== nginx configs with twcdn/xhttp/cdn ==='
grep -rln -E "twcdn|xhttp|cdn.tw|10444" /etc/nginx/ 2>/dev/null
echo
echo '=== xray config xhttp inbounds ==='
cat /usr/local/x-ui/bin/config.json 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);[print(json.dumps(i,indent=2)) for i in d.get('inbounds',[]) if 'xhttp' in json.dumps(i)]" 2>/dev/null
echo
echo '=== 3x-ui x-ui.db xhttp inbounds ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id, remark, port, protocol, listen, stream_settings FROM inbounds WHERE stream_settings LIKE '%xhttp%';" 2>/dev/null
echo
echo '=== listening ports ==='
ss -lntp | grep -E ':(443|8080|10444|80) ' 2>/dev/null
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
