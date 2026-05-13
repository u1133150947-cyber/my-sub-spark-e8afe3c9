import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== what runs on web.panelsu.ru :443 ==='
ss -lntp | grep -E ':(443|80) ' | head
echo
echo '=== nginx hy2 auth ==='
grep -rn 'hy2/auth\\|hy2_auth' /etc/nginx/ 2>/dev/null | head
echo
echo '=== xray clients in RU panel (cz-related inbounds) ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,port,protocol,remark FROM inbounds;"
echo
echo '=== RU x-ui clients count per inbound ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,protocol,remark,json_array_length(json_extract(settings,'$.clients')) as clients FROM inbounds;"
echo
echo '=== look for hy2 auth backend ==='
ls /opt /root 2>/dev/null | head -20
ps auxf | grep -iE 'hy2|hysteria' | grep -v grep | head
`;
c.on('ready',()=>c.exec(cmd,(_e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'web.panelsu.ru',port:22,username:'root',password:'hf6Ka8viMl'});
