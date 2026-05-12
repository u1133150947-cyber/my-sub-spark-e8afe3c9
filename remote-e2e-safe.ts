import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cat > /tmp/e2e_safe.py << 'PY'
import sqlite3, uuid, datetime, json, urllib.request, base64, sys
DB='/opt/sub-manager/data/app.db'
token='audit_'+uuid.uuid4().hex
expires=(datetime.datetime.utcnow()+datetime.timedelta(minutes=15)).isoformat()
con=sqlite3.connect(DB)
con.execute('insert into admin_sessions (id, token, expires_at) values (?, ?, ?)', (str(uuid.uuid4()), token, expires))
con.commit(); con.close()
BASE='http://127.0.0.1:8080/functions/v1/panel'
def api(action, body=None, method='POST'):
    url=BASE+'?action='+action
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(url, data=data, method=method, headers={'content-type':'application/json','x-admin-token':token})
    with urllib.request.urlopen(req, timeout=60) as r:
        txt=r.read().decode()
        print('API', action, r.status, txt[:500])
        j=json.loads(txt)
        if j.get('error'): raise Exception(j['error'])
        return j
created=api('create', {'name':'AuditFull','days':0,'totalGB':0,'selections':[{'panel':'pd4e485d3c9','inboundId':28},{'panel':'pd4e485d3c9','inboundId':29},{'panel':'pee9e3676f7','inboundId':1},{'panel':'pee9e3676f7','inboundId':2},{'panel':'pee9e3676f7','inboundId':3}]})
sub=created['subscription']
print('CREATED', sub['slug'], 'created=', len(created.get('created',[])), 'errors=', created.get('errors'))
if len(created.get('created',[])) != 5: raise Exception('not all inbounds created')
inb=api('inbounds', None, 'GET')
missing=[]
for c in created['created']:
    panel=c['panel']; iid=c['inboundId']
    arr=inb.get(panel,[])
    ib=next((x for x in arr if int(x['id'])==int(iid)), None)
    if not ib: missing.append([panel,iid,'inbound missing']); continue
    email_prefix=sub['client_email']+'_'+panel+str(iid)
    ok=any((cl.get('email') or '').startswith(email_prefix) or cl.get('id')==sub['client_uuid'] for cl in ib.get('clients',[]))
    print('LIVE_CLIENT', panel, iid, ok, 'clients=', len(ib.get('clients',[])))
    if not ok: missing.append([panel,iid,'client missing'])
if missing: raise Exception('missing live clients '+json.dumps(missing))
with urllib.request.urlopen('http://127.0.0.1:8080/sub/'+sub['slug'], timeout=60) as r:
    raw=r.read().decode()
    decoded=base64.b64decode(raw).decode()
    print('SUB_DECODED\\n'+decoded)
    lines=[x for x in decoded.split('\\n') if x]
    v=sum(x.startswith('vless://') for x in lines); h=sum(x.startswith('hysteria2://') for x in lines)
    print('LINE_COUNTS', len(lines), v, h)
    if v < 3 or h < 2: raise Exception('bad line counts')
upd=api('update', {'id':sub['id'],'days':3,'totalGB':5})
if upd.get('errors'): raise Exception('update errors '+json.dumps(upd['errors']))
delr=api('delete', {'id':sub['id']})
print('DELETE_ERRORS', delr.get('errors'))
print('E2E_OK')
PY
python3 /tmp/e2e_safe.py`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', (code) => { console.log('EXIT', code); conn.end(); }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
