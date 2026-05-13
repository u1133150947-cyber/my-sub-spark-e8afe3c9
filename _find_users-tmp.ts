import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== RU x-ui inbounds ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,port,protocol,remark FROM inbounds;"
echo
echo '=== clients per inbound (count) ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,protocol,remark,json_array_length(json_extract(settings,'\\$.clients')) FROM inbounds;"
echo
echo '=== nginx hy2 auth backend ==='
grep -rn 'hy2/auth\\|hy2_auth\\|/api/hy2' /etc/nginx/ 2>/dev/null | head
echo
echo '=== panelsu app dir ==='
ls /opt /root 2>/dev/null
ps auxf | grep -iE 'node|python|deno|hy2' | grep -v grep | head -20
`;
c.on('ready',()=>c.exec(cmd,(_e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
