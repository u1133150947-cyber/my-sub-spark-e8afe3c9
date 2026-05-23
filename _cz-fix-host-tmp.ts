import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set -e
systemctl stop x-ui
sleep 2
python3 <<'PY'
import sqlite3, json
db = sqlite3.connect('/etc/x-ui/x-ui.db')
cur = db.cursor()
row = cur.execute("SELECT stream_settings FROM inbounds WHERE id=23").fetchone()
stream = json.loads(row[0])
stream['xhttpSettings']['host'] = 'cdn-origin.panelsu.ru'
cur.execute("UPDATE inbounds SET stream_settings=? WHERE id=23", (json.dumps(stream),))
db.commit()
print("host set:", stream['xhttpSettings']['host'])
PY
systemctl start x-ui
sleep 3
systemctl is-active x-ui && echo "x-ui OK"
sleep 2

echo
echo '=== test direct to xray with proper Host ==='
curl -sS -m 5 -H 'Host: cdn-origin.panelsu.ru' http://127.0.0.1:10444/twcdn-xhttp/ -o /tmp/r -w 'direct xray -> %{http_code}\n'; cat /tmp/r; echo
echo
echo '=== test through origin nginx (GET stream-one path) ==='
curl -k -sS -m 5 https://cdn-origin.panelsu.ru/twcdn-xhttp/ -o /tmp/r -w 'origin -> %{http_code}\n'; cat /tmp/r; echo
echo
echo '=== test through CDN ==='
curl -sS -m 10 https://kclxvgxzs7.cdn.twcstorage.ru/twcdn-xhttp/ -o /tmp/r -w 'CDN -> %{http_code}\n'; cat /tmp/r; echo
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
