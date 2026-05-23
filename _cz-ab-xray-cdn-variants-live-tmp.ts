import { Client } from 'ssh2';
const c = new Client();
const cmd = String.raw`
set +e
XR=/usr/local/x-ui/bin/xray-linux-amd64
UUID=1ad2264f-1e15-4f0b-b5aa-1acde945af9e

test_case(){
  name="$1"; addr="$2"; sni="$3"; host="$4"; path="$5"; port="$6"; nosse="$7"; alpn="$8"
  cfg=/tmp/xray-client-$port.json
  log=/tmp/xray-client-$port.log
  if [ "$alpn" = h1 ]; then ALPN='["http/1.1"]'; else ALPN='["h2","http/1.1"]'; fi
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
      "tlsSettings":{"serverName":"$sni","fingerprint":"chrome","alpn":$ALPN},
      "xhttpSettings":{"path":"$path","host":"$host","mode":"stream-one","headers":{"User-Agent":"Mozilla/5.0"},"noSSEHeader":$nosse}
    }
  }]
}
EOF
  echo; echo "=== CASE $name ==="
  echo "addr=$addr sni=$sni host=$host path=$path nosse=$nosse alpn=$alpn socks=$port"
  rm -f "$log" /tmp/ab-ip
  $XR run -c "$cfg" >/tmp/xray-client-$port.stdout 2>&1 &
  pid=$!
  sleep 2
  if ! kill -0 $pid 2>/dev/null; then echo 'client failed to start'; cat /tmp/xray-client-$port.stdout; cat "$log" 2>/dev/null; return; fi
  curl -sS --socks5-hostname 127.0.0.1:$port -m 18 https://api.ipify.org -o /tmp/ab-ip -w 'curl_code=%{http_code} remote=%{remote_ip} time=%{time_total} err=%{errormsg}\n'
  echo -n 'body='; cat /tmp/ab-ip 2>/dev/null; echo
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
  echo '-- client status lines --'; tail -80 "$log" 2>/dev/null | grep -Ei 'xhttp|splithttp|unexpected status|failed|dialing|host|http version|path|vless' | tail -40 || true
}

test_case 'D_CDN_host_origin_slash' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' 'cdn-origin.panelsu.ru' '/twcdn-xhttp/' 18083 false h2
test_case 'E_CDN_host_cdn_noSSE' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' '/twcdn-xhttp/' 18084 true h2
test_case 'F_CDN_host_origin_noSSE' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' 'cdn-origin.panelsu.ru' '/twcdn-xhttp/' 18085 true h2
test_case 'G_CDN_h1_noSSE' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' 'kclxvgxzs7.cdn.twcstorage.ru' '/twcdn-xhttp/' 18086 true h1

echo; echo '=== origin/CDN nginx access after variants ==='
grep 'twcdn-xhttp' /var/log/nginx/access.log 2>/dev/null | tail -30
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('\nEXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:', e.message); process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:10000});
