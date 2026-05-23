import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== ВСЕ слушающие порты ==='
ss -lntp | grep -v 127.0.0.53
echo
echo '=== 3x-ui процесс ==='
systemctl status x-ui --no-pager 2>/dev/null | head -5
echo
echo '=== nginx установлен? ==='
which nginx && nginx -v 2>&1 || echo "nginx НЕ установлен"
echo
echo '=== все inbounds 3x-ui ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id, remark, port, protocol, listen, enable FROM inbounds;"
echo
echo '=== панель 3x-ui порт ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT key,value FROM settings WHERE key IN ('webPort','webBasePath','webDomain','webCertFile','webKeyFile');"
echo
echo '=== DNS зона — есть ли поддомен под CDN? ==='
echo "(надо знать какие домены у тебя есть)"
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
