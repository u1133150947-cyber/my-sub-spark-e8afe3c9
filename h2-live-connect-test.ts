import { Client } from 'ssh2';
const tests = [
  { from: 'RU', host: '82.202.128.147', password: 'K!E2QAGrxYFx', targetName: 'CZ', address: 'cz.panelsu.ru', port: 44433, sni: 'cz.panelsu.ru', auth: '80c4aa5b-607f-4143-9dd1-aa8b12ec4195' },
  { from: 'CZ', host: '185.87.148.138', password: 'hf6Ka8viMl', targetName: 'RU', address: 'ru.panelsu.ru', port: 44433, sni: 'ru.panelsu.ru', auth: '80c4aa5b-607f-4143-9dd1-aa8b12ec4195' },
];
function config(t:any, withAlpn:boolean){ return JSON.stringify({
  log:{loglevel:'debug'},
  inbounds:[{listen:'127.0.0.1',port:19090,protocol:'socks',settings:{auth:'noauth',udp:true},tag:'socks'}],
  outbounds:[{tag:'proxy',protocol:'hysteria',settings:{address:t.address,port:t.port,version:2},streamSettings:{network:'hysteria',security:'tls',hysteriaSettings:{auth:t.auth,version:2},tlsSettings:{serverName:t.sni,fingerprint:'chrome',...(withAlpn?{alpn:['h3']}:{})}}}]
}, null, 2).replace(/'/g,"'\\''"); }
function cmd(t:any){ return `set -e
XRAY=/usr/local/x-ui/bin/xray-linux-amd64
[ -x "$XRAY" ] || XRAY=/usr/local/x-ui/bin/xray
rm -f /tmp/h2test.log /tmp/h2test.pid
for MODE in noalpn alpn; do
  echo "== TEST ${t.from}->${t.targetName} $MODE =="
  if [ "$MODE" = alpn ]; then CFG='${config(t,true)}'; else CFG='${config(t,false)}'; fi
  printf "%s" "$CFG" > /tmp/h2test.json
  timeout 1 "$XRAY" test -c /tmp/h2test.json || true
  ("$XRAY" run -c /tmp/h2test.json > /tmp/h2test.log 2>&1 & echo $! > /tmp/h2test.pid)
  for i in $(seq 1 20); do ss -lnt | grep -q ':19090' && break; sleep 0.2; done
  curl -x socks5h://127.0.0.1:19090 -m 8 -sS -w '\nCURL_HTTP=%{http_code} TIME=%{time_total}\n' http://cp.cloudflare.com/generate_204 -o /tmp/h2curl.out || true
  cat /tmp/h2curl.out 2>/dev/null || true
  kill $(cat /tmp/h2test.pid) 2>/dev/null || true; sleep 0.5
  echo '-- LOG --'; tail -80 /tmp/h2test.log || true
  echo
 done`; }
async function runOne(t:any){return new Promise<void>(resolve=>{const c=new Client(); console.log('\n########',t.from,'testing',t.targetName,'########'); c.on('ready',()=>c.exec(cmd(t),(err,s)=>{if(err){console.error(err); c.end(); resolve(); return;} s.on('close',()=>{c.end(); resolve();}).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))})).on('error',(e:any)=>{console.error(e.message); resolve();}).connect({host:t.host,port:22,username:'root',password:t.password, readyTimeout:15000})})}
for (const t of tests) await runOne(t);
