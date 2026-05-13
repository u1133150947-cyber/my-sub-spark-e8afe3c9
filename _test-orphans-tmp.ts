import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});});}

const script = `
set +e
cat > /tmp/orphans.py << 'PY'
import sqlite3, json, urllib.request, urllib.parse, ssl, http.cookiejar, os

DB = '/opt/sub-manager/data/app.db'
conn = sqlite3.connect(DB)

# Get panel creds from DB
cur = conn.execute("SELECT slug, panel_url, username, password FROM panels")
panels = cur.fetchall()
print("Panels:", [p[0] for p in panels])

ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE

for slug, url, user, pw in panels:
    print(f"\\n═══ Panel {slug} ({url}) ═══")
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx), urllib.request.HTTPCookieProcessor(cj))
    
    data = urllib.parse.urlencode({'username': user, 'password': pw}).encode()
    try:
        r = opener.open(url.rstrip('/')+'/login', data=data, timeout=10)
        login = json.loads(r.read())
        if not login.get('success'):
            print(f"  login failed: {login}")
            continue
    except Exception as e:
        print(f"  login err: {e}"); continue
    
    try:
        r = opener.open(url.rstrip('/')+'/panel/api/inbounds/list', data=b'', timeout=15)
        ibs = json.loads(r.read())
    except Exception as e:
        print(f"  list err: {e}"); continue
    
    if not ibs.get('success'):
        print(f"  list failed: {ibs.get('msg')}"); continue
    
    # DB known emails+uuids for this panel
    db_emails = set(r[0] for r in conn.execute("SELECT client_email FROM subscription_inbounds WHERE panel=?", (slug,)))
    db_uuids = set(r[0] for r in conn.execute("SELECT s.client_uuid FROM subscriptions s JOIN subscription_inbounds si ON si.subscription_id=s.id WHERE si.panel=?", (slug,)))
    
    for ib in ibs['obj']:
        try: settings = json.loads(ib.get('settings','{}'))
        except: settings = {}
        clients = settings.get('clients', [])
        print(f"  inbound #{ib['id']} '{ib.get('remark','')[:30]}' port={ib['port']} → {len(clients)} clients on panel")
        orphan_email = []; orphan_uuid = []; ok = 0
        for c in clients:
            em = c.get('email',''); uid = c.get('id','')
            if em in db_emails: ok += 1
            else: orphan_email.append(em)
            if uid not in db_uuids: orphan_uuid.append((em, uid[:8]))
        print(f"     ✓ matched in DB by email: {ok}")
        if orphan_email:
            print(f"     ⚠ ORPHAN clients on panel (email NOT in DB): {len(orphan_email)}")
            for em in orphan_email[:10]: print(f"        - {em}")

# Reverse: DB rows where client missing on panel
print("\\n═══ DB rows whose client_email is NOT on panel ═══")
# (would need second pass; skipping for brevity)
PY
python3 /tmp/orphans.py
`;
console.log(await ssh(script));
