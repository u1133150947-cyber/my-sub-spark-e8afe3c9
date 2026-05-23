import { Client } from 'ssh2';
const c = new Client();
const DOMAIN = 'cdn-origin.panelsu.ru';
const PATH = '/twcdn-xhttp';
const PORT_LOCAL = 10444;
const cmd = `
set -e
echo '=== 1. DNS check ==='
host ${DOMAIN} 1.1.1.1 || nslookup ${DOMAIN} 1.1.1.1 || true
RESOLVED=$(host ${DOMAIN} 1.1.1.1 2>/dev/null | awk '/has address/{print $4}' | head -1)
echo "resolved: $RESOLVED"
if [ "$RESOLVED" != "185.87.148.138" ]; then
  echo "ERROR: DNS does not point to this server yet"; exit 1
fi

echo
echo '=== 2. acme.sh install / cert issue ==='
[ -d ~/.acme.sh ] || curl -s https://get.acme.sh | sh -s email=admin@panelsu.ru
~/.acme.sh/acme.sh --set-default-ca --server letsencrypt 2>&1 | tail -2

# stop nginx if running (we will restart with new conf)
systemctl stop nginx 2>/dev/null || true
# free :80 for standalone
fuser -k 80/tcp 2>/dev/null || true
sleep 1

if [ ! -f ~/.acme.sh/${DOMAIN}_ecc/fullchain.cer ]; then
  ~/.acme.sh/acme.sh --issue --standalone -d ${DOMAIN} --keylength ec-256 --server letsencrypt
fi

mkdir -p /etc/ssl/xhttp
~/.acme.sh/acme.sh --install-cert -d ${DOMAIN} --ecc \\
  --fullchain-file /etc/ssl/xhttp/fullchain.pem \\
  --key-file /etc/ssl/xhttp/key.pem \\
  --reloadcmd "systemctl reload nginx 2>/dev/null || true"

ls -la /etc/ssl/xhttp/

echo
echo '=== 3. nginx config ==='
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
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
NGINX
mkdir -p /etc/nginx/sites-enabled
ln -sf /etc/nginx/sites-available/xhttp-cdn.conf /etc/nginx/sites-enabled/xhttp-cdn.conf
# ensure main nginx.conf includes sites-enabled
grep -q 'sites-enabled' /etc/nginx/nginx.conf || sed -i '/http {/a \\    include /etc/nginx/sites-enabled/*.conf;' /etc/nginx/nginx.conf
nginx -t

echo
echo '=== 4. update 3x-ui inbound 23 ==='
systemctl stop x-ui
sleep 2
python3 <<'PY'
import sqlite3, json, uuid
db = sqlite3.connect('/etc/x-ui/x-ui.db')
cur = db.cursor()
row = cur.execute("SELECT id, settings, stream_settings FROM inbounds WHERE id=23").fetchone()
iid, settings_s, stream_s = row
settings = json.loads(settings_s)
clients = settings.get('clients', [])
if not clients:
    clients = [{}]
client_uuid = clients[0].get('id') or str(uuid.uuid4())
clients[0] = {
    "id": client_uuid,
    "flow": "",
    "email": clients[0].get('email') or 'xhttp-cdn',
    "limitIp": 0, "totalGB": 0, "expiryTime": 0, "enable": True,
    "tgId": "", "subId": clients[0].get('subId') or uuid.uuid4().hex[:16], "reset": 0
}
settings['clients'] = clients
settings.setdefault('decryption', 'none')
settings.setdefault('fallbacks', [])

stream = {
    "network": "xhttp",
    "security": "none",
    "externalProxy": [],
    "xhttpSettings": {
        "path": "/twcdn-xhttp",
        "host": "",
        "headers": {},
        "scMaxBufferedPosts": 30,
        "scMaxEachPostBytes": "1000000",
        "noSSEHeader": False,
        "xPaddingBytes": "100-1000",
        "mode": "packet-up",
        "extra": {
            "packetEncoding": "xudp",
            "xPaddingBytes": "100-1000",
            "xPaddingHeader": "X-Padding",
            "xPaddingKey": "x_padding",
            "xPaddingMethod": "tokenish",
            "xPaddingObfsMode": True,
            "xPaddingPlacement": "cookie"
        }
    },
    "sockopt": {"acceptProxyProtocol": False, "tcpFastOpen": False, "mark": 0, "tproxy": "off"}
}

cur.execute(
    "UPDATE inbounds SET listen=?, port=?, settings=?, stream_settings=?, remark=? WHERE id=23",
    ("127.0.0.1", 10444, json.dumps(settings), json.dumps(stream), "cz-xhttp-cdn-tw")
)
db.commit()
print("UPDATED inbound 23")
print("UUID:", client_uuid)
open('/tmp/xhttp-uuid', 'w').write(client_uuid)
PY

systemctl start x-ui
sleep 3
systemctl is-active x-ui

systemctl start nginx
sleep 2
systemctl is-active nginx

echo
echo '=== 5. listening ports after ==='
ss -lntp | grep -E ':(443|10444|8443|2053|8080) '

echo
echo '=== 6. local test (nginx -> xray) ==='
curl -k -sS -m 5 https://${DOMAIN}/ -o /tmp/r.out -w 'GET / -> %{http_code}\n'
curl -k -sS -m 5 -X POST https://${DOMAIN}/twcdn-xhttp/test --data 'x' -o /dev/null -w 'POST /twcdn-xhttp -> %{http_code}\n'

echo
echo '=== UUID for client ==='
cat /tmp/xhttp-uuid; echo
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('\nEXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
