import { Client } from 'ssh2';
const c = new Client();
const cmd = String.raw`
set +e
XR=/usr/local/x-ui/bin/xray-linux-amd64
UUID=1ad2264f-1e15-4f0b-b5aa-1acde945af9e

echo '=== nginx host line ==='
nginx -T 2>/dev/null | grep -A12 'location /twcdn-xhttp' | head -20

echo; echo '=== fresh log marker ==='
date -Is | tee /tmp/ab-marker-time

test_case(){
  name="$1"; addr="$2"; sni="$3"; host="$4"; path="$5"; port="$6"
  cfg=/tmp/xray-client-$port.json
  log=/tmp/xray-client-$port.log
  cat > "$cfg" <<EOF
{
  "log": {"loglevel": "debug", "error": "$log"},
  "inbounds": [{"listen":"127.0.0.1","port":$port,"protocol":"socks","settings":{"auth":"noauth","udp":true}}],
  "outbounds": [{
    "protocol":"vless",
    "settings":{"vnext":[{"address":"$addr","port":443,"users":[{"id":"$UUID","encryption":"none","flow":""}]}]},
    "streamSettings":{
      "network":"xhttp",
      "security":"tls",
      "tlsSettings":{"serverName":"$sni","fingerprint":"chrome","alpn":["h2","http/1.1"]},
      "xhttpSettings":{"path":"$path","host":"$host","mode":"stream-one","headers":{},"noSSEHeader":false}
    }
  }]
}
EOF
  echo; echo "=== CASE $name ==="
  echo "addr=$addr sni=$sni host=$host path=$path socks=$port"
  rm -f "$log"
  $XR run -c "$cfg" >/tmp/xray-client-$port.stdout 2>&1 &
  pid=$!
  sleep 2
  if ! kill -0 $pid 2>/dev/null; then echo 'client failed to start'; cat /tmp/xray-client-$port.stdout; cat "$log" 2>/dev/null; return; fi
  curl -sS --socks5-hostname 127.0.0.1:$port -m 20 https://api.ipify.org -o /tmp/ab-ip -w 'curl_code=%{http_code} remote=%{remote_ip} time=%{time_total} err=%{errormsg}\n'
  echo -n 'body='; cat /tmp/ab-ip; echo
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
  echo '-- client log tail --'; tail -50 "$log" 2>/dev/null | grep -Ei 'xhttp|splithttp|vless|failed|error|accepted|connected|request' | tail -30 || true
}

test_case 'A_current_CDN_no_slash' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' '/twcdn-xhttp' 18080
test_case 'B_CDN_with_slash' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' '/twcdn-xhttp/' 18081
test_case 'C_origin_with_slash' 'cdn-origin.panelsu.ru' 'cdn-origin.panelsu.ru' 'cdn-origin.panelsu.ru' '/twcdn-xhttp/' 18082

echo; echo '=== fresh server errors after A/B ==='
tail -220 /usr/local/x-ui/bin/error.log | grep -Ei 'xhttp|splithttp|host|path|failed|request|vless' | tail -120
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('\nEXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:', e.message); process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:10000});
