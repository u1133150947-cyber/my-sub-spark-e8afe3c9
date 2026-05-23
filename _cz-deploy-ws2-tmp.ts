import { Client } from 'ssh2';
const c = new Client();
const cmd = String.raw`
set +e
DB=/etc/x-ui/x-ui.db
UUID=1ad2264f-1e15-4f0b-b5aa-1acde945af9e

echo '=== 1. insert WS inbound ==='
python3 <<'PY'
import sqlite3, json, uuid
db=sqlite3.connect('/etc/x-ui/x-ui.db'); cur=db.cursor()
UUID="1ad2264f-1e15-4f0b-b5aa-1acde945af9e"
sub=uuid.uuid4().hex[:16]
settings={"clients":[{"id":UUID,"flow":"","email":"ws-cdn-main","limitIp":0,"totalGB":0,"expiryTime":0,"enable":True,"tgId":"","subId":sub,"reset":0}],"decryption":"none","fallbacks":[]}
stream={"network":"ws","security":"none","externalProxy":[],"wsSettings":{"acceptProxyProtocol":False,"path":"/twcdn-ws","host":"","headers":{}}}
sniff={"enabled":True,"destOverride":["http","tls","quic","fakedns"],"metadataOnly":False,"routeOnly":False}
cur.execute("DELETE FROM inbounds WHERE remark='WS-CDN'")
cur.execute("INSERT INTO inbounds(user_id,up,down,total,remark,enable,expiry_time,listen,port,protocol,settings,stream_settings,tag,sniffing) VALUES(1,0,0,0,'WS-CDN',1,0,'127.0.0.1',10445,'vless',?,?,?,?)",
  (json.dumps(settings),json.dumps(stream),"inbound-127.0.0.1:10445",json.dumps(sniff)))
db.commit(); print("ok id=",cur.lastrowid)
PY

echo '=== 2. restart x-ui ==='
systemctl restart x-ui
for i in 1 2 3 4 5 6 7 8; do ss -tlnp 2>/dev/null | grep -q ':10445' && break; sleep 1; done
ss -tlnp | grep -E ':1044[45]'

echo '=== 3. nginx upgrade probes ==='
curl -sS -o /dev/null -w 'origin_pub        code=%{http_code}\n' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' \
  https://cdn-origin.panelsu.ru/twcdn-ws
curl -sS -o /dev/null -w 'cdn               code=%{http_code}\n' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' \
  https://kclxvgxzs7.cdn.twcstorage.ru/twcdn-ws

echo '=== 4. A/B xray client (WS) ==='
XR=/usr/local/x-ui/bin/xray-linux-amd64
test_case(){
  name="$1"; addr="$2"; sni="$3"; host="$4"; port="$5"
  cfg=/tmp/wsc-$port.json; log=/tmp/wsc-$port.log
  cat > "$cfg" <<EOF
{"log":{"loglevel":"warning","error":"$log"},
 "inbounds":[{"listen":"127.0.0.1","port":$port,"protocol":"socks","settings":{"auth":"noauth","udp":true}}],
 "outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$addr","port":443,"users":[{"id":"$UUID","encryption":"none","flow":""}]}]},
  "streamSettings":{"network":"ws","security":"tls",
    "tlsSettings":{"serverName":"$sni","fingerprint":"chrome","alpn":["http/1.1"]},
    "wsSettings":{"path":"/twcdn-ws","headers":{"Host":"$host"}}}}]}
EOF
  echo; echo "--- CASE $name addr=$addr ---"
  rm -f "$log"
  $XR run -c "$cfg" >/tmp/wsc-$port.stdout 2>&1 &
  pid=$!; sleep 2
  if ! kill -0 $pid 2>/dev/null; then echo START_FAIL; cat /tmp/wsc-$port.stdout; return; fi
  curl -sS --socks5-hostname 127.0.0.1:$port -m 15 https://api.ipify.org -o /tmp/ip-$port -w 'ip_code=%{http_code} time=%{time_total}\n'
  echo "body=$(cat /tmp/ip-$port 2>/dev/null)"
  # speed test 19MB through tunnel
  curl -sS --socks5-hostname 127.0.0.1:$port -m 60 -o /dev/null \
    https://speed.cloudflare.com/__down?bytes=20000000 \
    -w 'dl20MB    code=%{http_code} time=%{time_total} speed=%{speed_download}\n'
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
  grep -Ei 'fail|error|reject|handshake' "$log" | tail -5
}
test_case A_ORIGIN cdn-origin.panelsu.ru cdn-origin.panelsu.ru cdn-origin.panelsu.ru 19090
test_case B_CDN    kclxvgxzs7.cdn.twcstorage.ru kclxvgxzs7.cdn.twcstorage.ru kclxvgxzs7.cdn.twcstorage.ru 19091

echo; echo '=== 5. build VLESS share links ==='
SUB=$(sqlite3 $DB "SELECT settings FROM inbounds WHERE remark='WS-CDN';" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['clients'][0]['subId'])")
echo "subId=$SUB"
echo
echo "ORIGIN: vless://${UUID}@cdn-origin.panelsu.ru:443?type=ws&security=tls&sni=cdn-origin.panelsu.ru&fp=chrome&alpn=http%2F1.1&host=cdn-origin.panelsu.ru&path=%2Ftwcdn-ws#CZ-WS-ORIGIN"
echo
echo "CDN:    vless://${UUID}@kclxvgxzs7.cdn.twcstorage.ru:443?type=ws&security=tls&sni=kclxvgxzs7.cdn.twcstorage.ru&fp=chrome&alpn=http%2F1.1&host=kclxvgxzs7.cdn.twcstorage.ru&path=%2Ftwcdn-ws#CZ-WS-CDN"
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('EXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:', e.message); process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:15000});
