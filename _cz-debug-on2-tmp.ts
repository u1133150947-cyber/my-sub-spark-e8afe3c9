import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set -e
python3 <<'PY'
import sqlite3, json
db = sqlite3.connect('/etc/x-ui/x-ui.db')
cur = db.cursor()
v = cur.execute("SELECT value FROM settings WHERE key='xrayTemplateConfig'").fetchone()[0]
tpl = json.loads(v)
tpl['log'] = {"loglevel":"debug","access":"/usr/local/x-ui/bin/access.log","error":"/usr/local/x-ui/bin/error.log"}
cur.execute("UPDATE settings SET value=? WHERE key='xrayTemplateConfig'", (json.dumps(tpl),))
db.commit()
print("template log updated")
PY
systemctl restart x-ui
sleep 4
jq '.log' /usr/local/x-ui/bin/config.json
touch /usr/local/x-ui/bin/access.log /usr/local/x-ui/bin/error.log
chmod 666 /usr/local/x-ui/bin/access.log /usr/local/x-ui/bin/error.log
echo "READY for live tail"
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
