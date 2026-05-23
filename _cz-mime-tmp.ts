import { Client } from 'ssh2';
const c = new Client();
const cmd = `
# just create minimal mime.types ourselves
cat > /etc/nginx/mime.types <<'MIME'
types {
    text/html                             html htm shtml;
    text/css                              css;
    text/xml                              xml;
    application/javascript                js;
    application/json                      json;
    application/octet-stream              bin exe dll;
    image/png                             png;
    image/jpeg                            jpeg jpg;
    text/plain                            txt;
}
MIME
nginx -t
systemctl restart nginx
sleep 1
systemctl is-active nginx
ss -lntp | grep -E ':(443|10444|8443|2053|8080) '
echo
curl -k -sS -m 5 https://cdn-origin.panelsu.ru/ -w '\nGET / -> %{http_code}\n'
curl -k -sS -m 5 -X POST https://cdn-origin.panelsu.ru/twcdn-xhttp/x -d 'a' -o /dev/null -w 'POST /twcdn-xhttp -> %{http_code}\n'
echo
echo 'UUID:'; cat /tmp/xhttp-uuid
echo
sqlite3 /etc/x-ui/x-ui.db "SELECT id, port, listen, remark FROM inbounds;"
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('EXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
