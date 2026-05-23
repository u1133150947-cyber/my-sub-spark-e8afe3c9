import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set -e
apt-get install -y --reinstall nginx-common nginx-core 2>&1 | tail -3
ls /etc/nginx/mime.types && echo "mime ok"
# our custom nginx.conf already exists with our config — keep it but check
ls /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
sleep 1
systemctl is-active nginx
ss -lntp | grep -E ':(443|10444) '
echo
curl -k -sS -m 5 https://cdn-origin.panelsu.ru/ -w '\nGET / -> %{http_code}\n'
curl -k -sS -m 5 -X POST https://cdn-origin.panelsu.ru/twcdn-xhttp/x -d 'a' -o /dev/null -w 'POST /twcdn-xhttp -> %{http_code}\n'
echo
echo 'UUID:'; cat /tmp/xhttp-uuid; echo
echo 'inbound 23 in db:'
sqlite3 /etc/x-ui/x-ui.db "SELECT id, port, listen, remark FROM inbounds WHERE id=23;"
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('EXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
