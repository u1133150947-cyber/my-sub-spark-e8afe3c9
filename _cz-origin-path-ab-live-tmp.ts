import { Client } from 'ssh2';
const c = new Client();
const cmd = String.raw`
set +e
XR=/usr/local/x-ui/bin/xray-linux-amd64
UUID=1ad2264f-1e15-4f0b-b5aa-1acde945af9e
mk(){
  name="$1"; path="$2"; port="$3"
  cfg=/tmp/origin-path-$port.json; log=/tmp/origin-path-$port.log
  cat > "$cfg" <<EOF
{"log":{"loglevel":"debug","error":"$log"},"inbounds":[{"listen":"127.0.0.1","port":$port,"protocol":"socks","settings":{"auth":"noauth","udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"cdn-origin.panelsu.ru","port":443,"users":[{"id":"$UUID","encryption":"none"}]}]},"streamSettings":{"network":"xhttp","security":"tls","tlsSettings":{"serverName":"cdn-origin.panelsu.ru","fingerprint":"chrome","alpn":["h2","http/1.1"]},"xhttpSettings":{"path":"$path","host":"cdn-origin.panelsu.ru","mode":"stream-one","headers":{},"noSSEHeader":false}}}]}
EOF
  echo "=== $name path=$path ==="
  $XR run -c "$cfg" >/tmp/origin-path-$port.out 2>&1 & pid=$!; sleep 2
  curl -sS --socks5-hostname 127.0.0.1:$port -m 12 https://api.ipify.org -o /tmp/ip-$port -w 'code=%{http_code} time=%{time_total} err=%{errormsg}\n'
  echo -n 'ip='; cat /tmp/ip-$port 2>/dev/null; echo
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
  tail -50 "$log" | grep -Ei 'unexpected status|failed|xhttp|splithttp' | tail -15 || true
}
mk 'ORIGIN_NO_SLASH' '/twcdn-xhttp' 18087
mk 'ORIGIN_WITH_SLASH' '/twcdn-xhttp/' 18088
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('\nEXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
