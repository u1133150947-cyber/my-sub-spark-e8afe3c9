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
row = cur.execute("SELECT settings, stream_settings FROM inbounds WHERE id=23").fetchone()
settings_s, stream_s = row
stream = json.loads(stream_s)
xh = stream.get('xhttpSettings', {})
old_mode = xh.get('mode')
xh['mode'] = 'stream-one'
# stream-one не использует POST буферизацию
xh.pop('scMaxBufferedPosts', None)
xh.pop('scMaxEachPostBytes', None)
stream['xhttpSettings'] = xh
cur.execute("UPDATE inbounds SET stream_settings=? WHERE id=23", (json.dumps(stream),))
db.commit()
print(f"mode: {old_mode} -> stream-one")
settings = json.loads(settings_s)
print("UUID:", settings['clients'][0]['id'])
print("subId:", settings['clients'][0].get('subId'))
print("email:", settings['clients'][0].get('email'))
PY
systemctl start x-ui
sleep 3
systemctl is-active x-ui && echo "x-ui OK"

echo
echo '=== xray xhttp settings after change ==='
sleep 2
CFG=\$(readlink /proc/\$(pgrep -f 'xray-linux')/cwd 2>/dev/null)/bin/config.json
jq '.inbounds[] | select(.streamSettings.network=="xhttp") | {tag, port, mode:.streamSettings.xhttpSettings.mode, path:.streamSettings.xhttpSettings.path}' "\$CFG" 2>/dev/null || echo "(не найден xray config)"

echo
echo '=== local test ==='
curl -k -sS -m 5 -X GET https://cdn-origin.panelsu.ru/twcdn-xhttp/test -o /dev/null -w 'GET /twcdn-xhttp -> %{http_code}\n'
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('EXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
