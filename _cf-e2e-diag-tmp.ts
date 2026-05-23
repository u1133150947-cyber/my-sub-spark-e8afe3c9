import { Client } from 'ssh2';
const c = new Client();
const cmd = String.raw`
set +e
XR=/usr/local/x-ui/bin/xray-linux-amd64
UUID=1ad2264f-1e15-4f0b-b5aa-1acde945af9e
PATH_WS=/twcdn-ws
printf '=== service ===\n'
systemctl is-active x-ui || true
printf '\n=== listeners ===\n'
ss -lntp | grep -E ':(443|80|1044|10445|10446|10447|10448|10449|10450|10451|10452|10453|10454)' || true
printf '\n=== nginx twcdn-ws ===\n'
nginx -T 2>/dev/null | grep -n -A18 -B5 'twcdn-ws' || true
printf '\n=== inbound rows with twcdn-ws ===\n'
python3 - <<'PY'
import sqlite3,json
con=sqlite3.connect('/etc/x-ui/x-ui.db')
cur=con.cursor()
for row in cur.execute("select id,port,protocol,settings,stream_settings,enable,remark from inbounds where stream_settings like '%twcdn-ws%' or remark like '%WS%' order by id"):
    id,port,proto,settings,stream,enable,remark=row
    print('ROW', {'id':id,'port':port,'protocol':proto,'enable':enable,'remark':remark})
    try:
      s=json.loads(stream); print('STREAM', json.dumps(s, ensure_ascii=False))
    except Exception as e: print('STREAM_ERR', e, stream[:300])
    try:
      st=json.loads(settings); print('CLIENTS', st.get('clients'))
    except Exception as e: print('SETTINGS_ERR', e, settings[:300])
PY
printf '\n=== external probes from server ===\n'
for u in https://cdn.panelsu.ru/ https://cdn.panelsu.ru/twcdn-ws https://cdn-origin.panelsu.ru/twcdn-ws; do
  echo "-- $u"
  curl -k -sS --http1.1 -m 8 -o /tmp/probe_body -w 'code=%{http_code} ip=%{remote_ip} connect=%{time_connect} tls=%{time_appconnect} total=%{time_total} err=%{errormsg}\n' "$u"
  head -c 120 /tmp/probe_body; echo
 done
run_case(){
  name="$1"; addr="$2"; sni="$3"; host="$4"; port="$5"
  cfg=/tmp/xray-ws-client-$port.json
  log=/tmp/xray-ws-client-$port.log
  out=/tmp/xray-ws-client-$port.out
  cat > "$cfg" <<EOF
{
  "log": {"loglevel":"debug", "error":"$log"},
  "inbounds": [{"listen":"127.0.0.1","port":$port,"protocol":"socks","settings":{"auth":"noauth","udp":true}}],
  "outbounds": [{
    "protocol":"vless",
    "settings":{"vnext":[{"address":"$addr","port":443,"users":[{"id":"$UUID","encryption":"none","flow":""}]}]},
    "streamSettings":{
      "network":"ws",
      "security":"tls",
      "tlsSettings":{"serverName":"$sni","fingerprint":"chrome","alpn":["http/1.1"],"allowInsecure":false},
      "wsSettings":{"path":"$PATH_WS","headers":{"Host":"$host"}}
    }
  }]
}
EOF
  rm -f "$log" "$out"
  echo; echo "=== CASE $name ==="
  echo "addr=$addr sni=$sni host=$host socks=$port"
  $XR run -c "$cfg" >"$out" 2>&1 &
  pid=$!
  sleep 2
  if ! kill -0 $pid 2>/dev/null; then echo 'client_not_started'; cat "$out"; cat "$log" 2>/dev/null; return; fi
  curl --socks5-hostname 127.0.0.1:$port -sS -m 25 https://api.ipify.org -o /tmp/ip-$port -w 'http=%{http_code} remote=%{remote_ip} total=%{time_total} err=%{errormsg}\n'
  echo -n 'body='; cat /tmp/ip-$port 2>/dev/null; echo
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
  echo '-- client log --'
  tail -80 "$log" 2>/dev/null | grep -Ei 'websocket|vless|tls|accepted|connected|failed|error|rejected|handshake|proxy' | tail -50 || true
}
run_case CF cdn.panelsu.ru cdn.panelsu.ru cdn.panelsu.ru 19091
run_case ORIGIN cdn-origin.panelsu.ru cdn-origin.panelsu.ru cdn-origin.panelsu.ru 19092
printf '\n=== server xray recent errors ===\n'
tail -220 /usr/local/x-ui/bin/error.log 2>/dev/null | grep -Ei 'twcdn-ws|websocket|vless|invalid|failed|rejected|host|path|uuid|permission|tls' | tail -120 || true
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('\nEXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:', e.message); process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:10000});
