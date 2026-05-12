import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cat > /tmp/sub_audit.py << 'PY'
import sqlite3, urllib.request, base64, traceback
DB='/opt/sub-manager/data/app.db'
con=sqlite3.connect(DB)
con.row_factory=sqlite3.Row
subs=con.execute("select id,slug,name,client_email,created_at from subscriptions order by created_at asc").fetchall()
print('SUB_COUNT', len(subs))
for s in subs:
    print('')
    print('==', s['slug'], s['name'], s['client_email'], '==')
    try:
        req=urllib.request.Request('http://127.0.0.1:8080/sub/'+s['slug'], headers={'User-Agent':'audit'})
        with urllib.request.urlopen(req, timeout=30) as r:
            raw=r.read().decode('utf-8', 'replace')
            print('HTTP', r.status, 'raw_len', len(raw), 'ct', r.headers.get('content-type'))
            try:
                dec=base64.b64decode(raw + '===').decode('utf-8','replace')
                lines=[x for x in dec.splitlines() if x.strip()]
                print('LINES', len(lines), 'vless', sum(x.startswith('vless://') for x in lines), 'h2', sum(x.startswith(('hysteria2://','hy2://')) for x in lines), 'other', sum(not x.startswith(('vless://','hysteria2://','hy2://')) for x in lines))
                for line in lines[:10]: print(' ', line[:220])
                if not lines: print('EMPTY_DECODED')
            except Exception as e:
                print('DECODE_ERR', repr(e), 'RAW_PREVIEW', raw[:500])
    except Exception as e:
        print('FETCH_ERR', repr(e))
        traceback.print_exc()
PY
python3 /tmp/sub_audit.py
printf '\n== recent service logs ==\n'
journalctl -u sub-manager -n 80 --no-pager`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
