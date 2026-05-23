import { Client } from 'ssh2';
const c = new Client();
const cmd = `
CFG=\$(readlink /proc/\$(pgrep -of 'xray-linux')/cwd 2>/dev/null)/bin/config.json
echo "CFG=\$CFG"
jq '.inbounds[] | select(.streamSettings.network=="xhttp") | {tag, port, listen, mode:.streamSettings.xhttpSettings.mode, path:.streamSettings.xhttpSettings.path, host:.streamSettings.xhttpSettings.host}' "\$CFG"
echo
echo '=== GET test via CDN (origin direct) ==='
curl -k -sS -m 8 -o /dev/null -w 'GET origin /twcdn-xhttp -> %{http_code}\n' https://cdn-origin.panelsu.ru/twcdn-xhttp/
echo
echo '=== GET test via Timeweb CDN ==='
curl -sS -m 10 -o /dev/null -w 'GET CDN /twcdn-xhttp -> %{http_code}\n' https://kclxvgxzs7.cdn.twcstorage.ru/twcdn-xhttp/
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
