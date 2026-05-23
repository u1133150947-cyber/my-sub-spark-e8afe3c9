import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set -e
# включаем access log у xray через панель
python3 <<'PY'
import sqlite3
db = sqlite3.connect('/etc/x-ui/x-ui.db')
cur = db.cursor()
for k, v in [('xrayTemplateConfig', None)]:
    pass
# проверим, есть ли в settings лог
rows = cur.execute("SELECT key, value FROM settings WHERE key LIKE '%og%' OR key LIKE '%xray%'").fetchall()
for r in rows: print(r[0], '=', (r[1][:80] if r[1] else r[1]))
PY
echo
# проще: правим bin/config.json напрямую и рестартим xray-процесс (НЕ x-ui)
jq '.log = {"loglevel":"debug","access":"/usr/local/x-ui/bin/access.log","error":"/usr/local/x-ui/bin/error.log"}' /usr/local/x-ui/bin/config.json > /tmp/c.json
mv /tmp/c.json /usr/local/x-ui/bin/config.json
touch /usr/local/x-ui/bin/access.log /usr/local/x-ui/bin/error.log
# рестарт x-ui чтобы перечитать
systemctl restart x-ui
sleep 3
systemctl is-active x-ui
echo
echo '=== подтверждаем log включён ==='
jq '.log' /usr/local/x-ui/bin/config.json
echo
echo '=== listening ==='
ss -lntp | grep 10444
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
