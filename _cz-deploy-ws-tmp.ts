import { Client } from 'ssh2';
const c = new Client();
const cmd = String.raw`
set +e
DB=/etc/x-ui/x-ui.db
UUID=1ad2264f-1e15-4f0b-b5aa-1acde945af9e
WS_PORT=10445
WS_PATH=/twcdn-ws

echo '=== 1. existing inbound 23 (xhttp) snapshot ==='
sqlite3 $DB "SELECT id,port,remark,protocol FROM inbounds;"

echo '=== 2. create new VLESS+WS inbound in x-ui DB ==='
python3 <<'PY'
import sqlite3, json, uuid, time
db=sqlite3.connect('/etc/x-ui/x-ui.db')
cur=db.cursor()
UUID="1ad2264f-1e15-4f0b-b5aa-1acde945af9e"
sub_id=uuid.uuid4().hex[:16]
settings={
  "clients":[{"id":UUID,"flow":"","email":"ws-cdn","limitIp":0,"totalGB":0,"expiryTime":0,"enable":True,"tgId":"","subId":sub_id,"reset":0}],
  "decryption":"none","fallbacks":[]
}
stream={
  "network":"ws",
  "security":"none",
  "externalProxy":[],
  "wsSettings":{"acceptProxyProtocol":False,"path":"/twcdn-ws","host":"","headers":{}}
}
sniffing={"enabled":False,"destOverride":["http","tls","quic","fakedns"],"metadataOnly":False,"routeOnly":False}
allocate={"strategy":"always","refresh":5,"concurrency":3}
now=int(time.time()*1000)
# remove old if exists
cur.execute("DELETE FROM inbounds WHERE remark='WS-CDN'")
cur.execute("""INSERT INTO inbounds(user_id,up,down,total,remark,enable,expiry_time,listen,port,protocol,settings,stream_settings,tag,sniffing,allocate)
  VALUES(1,0,0,0,'WS-CDN',1,0,'127.0.0.1',10445,'vless',?,?,?,?,?)""",
  (json.dumps(settings),json.dumps(stream),f"inbound-127.0.0.1:10445",json.dumps(sniffing),json.dumps(allocate)))
db.commit()
print("inserted id:", cur.lastrowid)
PY

echo '=== 3. restart x-ui ==='
systemctl restart x-ui
sleep 3
ss -tlnp | grep -E ':1044[45]'

echo '=== 4. nginx location ==='
if ! grep -q 'twcdn-ws' /etc/nginx/sites-available/xhttp-cdn.conf; then
  # insert before closing brace of server{}
  python3 - <<'PY'
p='/etc/nginx/sites-available/xhttp-cdn.conf'
s=open(p).read()
add='''
    location /twcdn-ws {
        proxy_pass http://127.0.0.1:10445;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
'''
# insert before last }
idx=s.rfind('}')
s=s[:idx]+add+s[idx:]
open(p,'w').write(s)
PY
fi
nginx -t && systemctl reload nginx
echo '--- nginx ws location ---'
grep -A8 twcdn-ws /etc/nginx/sites-available/xhttp-cdn.conf

echo '=== 5. server-side curl WS upgrade check (loop origin) ==='
curl -sS -o /dev/null -w 'origin_local code=%{http_code}\n' -k \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' \
  https://cdn-origin.panelsu.ru/twcdn-ws --resolve cdn-origin.panelsu.ru:443:127.0.0.1

curl -sS -o /dev/null -w 'origin_pub code=%{http_code}\n' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' \
  https://cdn-origin.panelsu.ru/twcdn-ws

curl -sS -o /dev/null -w 'cdn       code=%{http_code}\n' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' \
  https://kclxvgxzs7.cdn.twcstorage.ru/twcdn-ws

echo '=== 6. A/B xray client through CDN vs origin (WS) ==='
XR=/usr/local/x-ui/bin/xray-linux-amd64
test_case(){
  name="$1"; addr="$2"; sni="$3"; host="$4"; port="$5"
  cfg=/tmp/wsc-$port.json
  log=/tmp/wsc-$port.log
  cat > "$cfg" <<EOF
{"log":{"loglevel":"debug","error":"$log"},
 "inbounds":[{"listen":"127.0.0.1","port":$port,"protocol":"socks","settings":{"auth":"noauth","udp":true}}],
 "outbounds":[{"protocol":"vless",
   "settings":{"vnext":[{"address":"$addr","port":443,"users":[{"id":"$UUID","encryption":"none","flow":""}]}]},
   "streamSettings":{"network":"ws","security":"tls",
     "tlsSettings":{"serverName":"$sni","fingerprint":"chrome","alpn":["http/1.1"]},
     "wsSettings":{"path":"/twcdn-ws","headers":{"Host":"$host"}}}}]}
EOF
  echo; echo "=== CASE $name === addr=$addr"
  rm -f "$log"
  $XR run -c "$cfg" >/tmp/wsc-$port.stdout 2>&1 &
  pid=$!; sleep 2
  if ! kill -0 $pid 2>/dev/null; then echo START_FAIL; cat /tmp/wsc-$port.stdout; return; fi
  curl -sS --socks5-hostname 127.0.0.1:$port -m 15 https://api.ipify.org -o /tmp/ws-ip -w 'ip_code=%{http_code} time=%{time_total}\n'
  echo "body=$(cat /tmp/ws-ip 2>/dev/null)"
  # download 19M test
  curl -sS --socks5-hostname 127.0.0.1:$port -m 60 -o /dev/null https://cdn-origin.panelsu.ru/null 2>/dev/null
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
  echo '-- log --'; grep -Ei 'fail|error|accepted|established|websocket|reject' "$log" | tail -10
}
test_case A_ORIGIN_WS cdn-origin.panelsu.ru cdn-origin.panelsu.ru cdn-origin.panelsu.ru 19080
test_case B_CDN_WS    kclxvgxzs7.cdn.twcstorage.ru kclxvgxzs7.cdn.twcstorage.ru kclxvgxzs7.cdn.twcstorage.ru 19081

echo; echo '=== 7. server log (x-ui) tail ==='
tail -120 /usr/local/x-ui/bin/error.log 2>/dev/null | grep -Ei 'ws|websocket|accepted|vless|error|fail' | tail -40

echo; echo '=== 8. final inbounds list ==='
sqlite3 $DB "SELECT id,port,remark,protocol FROM inbounds;"
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('\nEXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:', e.message); process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:15000});
