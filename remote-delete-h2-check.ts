import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cat > /tmp/delete_h2_check.py << 'PY'
import sqlite3, uuid, datetime, json, urllib.request
DB='/opt/sub-manager/data/app.db'
token='audit_'+uuid.uuid4().hex
expires=(datetime.datetime.now(datetime.UTC)+datetime.timedelta(minutes=15)).isoformat()
con=sqlite3.connect(DB)
con.execute('insert into admin_sessions (id, token, expires_at) values (?, ?, ?)', (str(uuid.uuid4()), token, expires))
con.commit(); con.close()
BASE='http://127.0.0.1:8080/functions/v1/panel'
def api(action, body=None, method='POST'):
    req=urllib.request.Request(BASE+'?action='+action, data=None if body is None else json.dumps(body).encode(), method=method, headers={'content-type':'application/json','x-admin-token':token})
    with urllib.request.urlopen(req, timeout=60) as r:
        j=json.loads(r.read().decode())
        if j.get('error'): raise Exception(j['error'])
        return j
created=api('create', {'name':'AuditH2Delete','days':0,'totalGB':0,'selections':[{'panel':'pd4e485d3c9','inboundId':29},{'panel':'pee9e3676f7','inboundId':3}]})
sub=created['subscription']
print('CREATED', sub['slug'], len(created.get('created',[])), created.get('errors'))
delr=api('delete', {'id':sub['id']})
print('DELETE', delr)
if delr.get('errors'): raise Exception('delete errors '+json.dumps(delr['errors']))
print('DELETE_H2_OK')
PY
python3 /tmp/delete_h2_check.py`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', (code) => { console.log('EXIT', code); conn.end(); }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
