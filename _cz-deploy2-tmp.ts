import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set -e
# create nginx.conf
cat > /etc/nginx/nginx.conf <<'NGINX'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;
events { worker_connections 1024; }
http {
    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    gzip on;
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
NGINX

[ -f /etc/nginx/mime.types ] || apt-get install -y --reinstall nginx-common >/dev/null 2>&1

# write site conf
cat > /etc/nginx/sites-available/xhttp-cdn.conf <<'NGINX'
server {
    listen 443 ssl;
    http2 on;
    server_name cdn-origin.panelsu.ru;
    ssl_certificate     /etc/ssl/xhttp/fullchain.pem;
    ssl_certificate_key /etc/ssl/xhttp/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    location /twcdn-xhttp {
        proxy_pass http://127.0.0.1:10444;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }
    location / { return 200 'ok'; add_header Content-Type text/plain; }
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/xhttp-cdn.conf /etc/nginx/sites-enabled/xhttp-cdn.conf
nginx -t

echo '=== update inbound 23 ==='
systemctl stop x-ui
sleep 2
python3 <<'PY'
import sqlite3, json, uuid
db = sqlite3.connect('/etc/x-ui/x-ui.db')
cur = db.cursor()
row = cur.execute("SELECT id, settings FROM inbounds WHERE id=23").fetchone()
settings = json.loads(row[1])
clients = settings.get('clients') or [{}]
client_uuid = clients[0].get('id') or str(uuid.uuid4())
clients[0] = {
    "id": client_uuid, "flow": "",
    "email": clients[0].get('email') or 'xhttp-cdn',
    "limitIp":0,"totalGB":0,"expiryTime":0,"enable":True,
    "tgId":"","subId": clients[0].get('subId') or uuid.uuid4().hex[:16],"reset":0
}
settings['clients']=clients
settings.setdefault('decryption','none')
settings.setdefault('fallbacks',[])

stream = {
    "network":"xhttp","security":"none","externalProxy":[],
    "xhttpSettings": {
        "path":"/twcdn-xhttp","host":"","headers":{},
        "scMaxBufferedPosts":30,"scMaxEachPostBytes":"1000000",
        "noSSEHeader":False,"xPaddingBytes":"100-1000","mode":"packet-up",
        "extra": {
            "packetEncoding":"xudp",
            "xPaddingBytes":"100-1000",
            "xPaddingHeader":"X-Padding",
            "xPaddingKey":"x_padding",
            "xPaddingMethod":"tokenish",
            "xPaddingObfsMode":True,
            "xPaddingPlacement":"cookie"
        }
    },
    "sockopt":{"acceptProxyProtocol":False,"tcpFastOpen":False,"mark":0,"tproxy":"off"}
}
cur.execute("UPDATE inbounds SET listen=?, port=?, settings=?, stream_settings=?, remark=? WHERE id=23",
    ("127.0.0.1",10444,json.dumps(settings),json.dumps(stream),"cz-xhttp-cdn-tw"))
db.commit()
open('/tmp/xhttp-uuid','w').write(client_uuid)
print("UUID:", client_uuid)
PY

systemctl start x-ui
sleep 3
systemctl is-active x-ui && echo "x-ui OK"

systemctl enable nginx >/dev/null 2>&1
systemctl restart nginx
sleep 2
systemctl is-active nginx && echo "nginx OK"

echo
echo '=== listening ==='
ss -lntp | grep -E ':(443|10444|8443|2053|8080) '

echo
echo '=== local tests ==='
curl -k -sS -m 5 https://cdn-origin.panelsu.ru/ -w '\nGET / -> %{http_code}\n'
curl -k -sS -m 5 -X POST https://cdn-origin.panelsu.ru/twcdn-xhttp/x -d 'a' -o /dev/null -w 'POST /twcdn-xhttp -> %{http_code}\n'

echo
echo 'UUID:'; cat /tmp/xhttp-uuid; echo
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('EXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
