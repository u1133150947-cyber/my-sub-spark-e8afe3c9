import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== find xray process and config ==='
ps -ef | grep -E '[x]ray' | head -5
echo
echo '=== xray config location ==='
for p in /usr/local/etc/xray/config.json /etc/xray/config.json /opt/xray/config.json /root/xray/config.json; do
  test -f "\$p" && { echo "FOUND: \$p"; break; }
done
CFG=\$(ps -ef | grep -E '[x]ray' | grep -oE '/[^ ]+config[^ ]*\\.json' | head -1)
echo "CFG_FROM_PS=\$CFG"
[ -n "\$CFG" ] && {
  echo '--- inbounds tags+protocol+port ---'
  jq '.inbounds | map({tag, protocol, port, listen, net:.streamSettings.network, path:.streamSettings.xhttpSettings.path, mode:.streamSettings.xhttpSettings.mode})' "\$CFG"
  echo '--- outbounds ---'
  jq '.outbounds' "\$CFG"
  echo '--- routing ---'
  jq '.routing' "\$CFG" 2>/dev/null | head -40
}

echo
echo '=== curl origin direct (twcdn-xhttp path) ==='
curl -sk -m 6 -o /dev/null -w 'origin direct %{http_code}\\n' https://127.0.0.1/twcdn-xhttp
curl -sk -m 6 -o /dev/null -w 'origin POST    %{http_code}\\n' -X POST https://127.0.0.1/twcdn-xhttp -d test

echo
echo '=== curl CDN public ==='
for D in kclxvgxzs7.cdn.twcstorage.ru; do
  echo "--- \$D ---"
  curl -sk -m 8 -o /dev/null -w 'GET  /            %{http_code} ct=%{content_type}\\n' https://\$D/
  curl -sk -m 8 -o /dev/null -w 'GET  /twcdn-xhttp %{http_code}\\n' https://\$D/twcdn-xhttp
  curl -sk -m 8 -o /dev/null -w 'POST /twcdn-xhttp %{http_code}\\n' -X POST https://\$D/twcdn-xhttp -d hello
done
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:',e.message);process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:8000});
