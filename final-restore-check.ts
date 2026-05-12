import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cat > /tmp/final_check.py << 'PY'
import sqlite3, urllib.request, base64, json, uuid, datetime
print('== ports from web server ==')
import socket
for h,p in [('ru.panelsu.ru',8443),('ru.panelsu.ru',4430),('cz.panelsu.ru',2080)]:
    s=socket.socket(); s.settimeout(3)
    try: s.connect((h,p)); print('OPEN',f'{h}:{p}')
    except Exception as e: print('CLOSED',f'{h}:{p}',e)
    finally: s.close()
print('== old subscriptions ==')
con=sqlite3.connect('/opt/sub-manager/data/app.db'); con.row_factory=sqlite3.Row
subs=con.execute('select slug,name from subscriptions order by created_at asc').fetchall()
for sub in subs:
    with urllib.request.urlopen('http://127.0.0.1:8080/sub/'+sub['slug'], timeout=20) as r:
        raw=r.read().decode(); dec=base64.b64decode(raw+'===').decode('utf-8','replace'); lines=[x for x in dec.splitlines() if x]
        print(sub['slug'], sub['name'], 'HTTP', r.status, 'lines', len(lines), 'vless', sum(x.startswith('vless://') for x in lines), 'h2', sum(x.startswith('hysteria2://') for x in lines))
print('== panel login checks ==')
token='audit_'+uuid.uuid4().hex
expires=(datetime.datetime.now(datetime.UTC)+datetime.timedelta(minutes=5)).isoformat()
con.execute('insert into admin_sessions (id, token, expires_at) values (?, ?, ?)', (str(uuid.uuid4()), token, expires)); con.commit()
for p in con.execute('select name,panel_url,username,password from panels'):
    data=json.dumps({'panel_url':p['panel_url'],'username':p['username'],'password':p['password']}).encode()
    req=urllib.request.Request('http://127.0.0.1:8080/functions/v1/panel?action=testPanel', data=data, method='POST', headers={'content-type':'application/json','x-admin-token':token})
    with urllib.request.urlopen(req, timeout=30) as r: print(p['name'], r.read().decode())
PY
python3 /tmp/final_check.py`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
