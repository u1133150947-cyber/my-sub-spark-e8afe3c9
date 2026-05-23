import { Client } from 'ssh2';
const c = new Client();
const cmd = `
CWD=\$(readlink /proc/533075/cwd 2>/dev/null)
echo "xray CWD=\$CWD"
CFG="\$CWD/bin/config.json"
echo "CFG=\$CFG"
[ -f "\$CFG" ] && {
  echo '--- inbounds summary ---'
  jq '.inbounds | map({tag, protocol, port, listen, net:.streamSettings.network, path:.streamSettings.xhttpSettings.path, mode:.streamSettings.xhttpSettings.mode, xPP:.streamSettings.xhttpSettings.extra.xPaddingPlacement})' "\$CFG"
  echo '--- outbounds ---'
  jq '.outbounds | map({tag, protocol, send: .settings.domainStrategy})' "\$CFG"
  echo '--- routing rules ---'
  jq '.routing.rules' "\$CFG"
} || echo "NO CFG FOUND"

echo
echo '=== xray live log tail (stderr) ==='
journalctl --since '5 min ago' --no-pager 2>/dev/null | grep -iE 'xray|vless' | tail -30
test -f \$CWD/bin/access.log && tail -20 \$CWD/bin/access.log
test -f \$CWD/bin/error.log && tail -20 \$CWD/bin/error.log

echo
echo '=== curl with proper xhttp headers ==='
curl -sk -m 6 -o /dev/null -w 'localhost xhttp-up GET  %{http_code}\\n' \
  -H 'X-Request-Id: abc123' \
  https://127.0.0.1/twcdn-xhttp/up/abc123/0
curl -sk -m 6 -o /dev/null -w 'localhost xhttp     POST %{http_code}\\n' \
  -H 'Content-Type: application/grpc' -X POST \
  https://127.0.0.1/twcdn-xhttp/up/abc123/0 -d '0'
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:',e.message);process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:8000});
