import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set -e
cp -a /etc/nginx/sites-enabled/xhttp-cdn.conf /etc/nginx/sites-enabled/xhttp-cdn.conf.bak.$(date +%s)
python3 <<'PY'
from pathlib import Path
paths=[Path('/etc/nginx/sites-enabled/xhttp-cdn.conf'), Path('/etc/nginx/sites-available/xhttp-cdn.conf')]
for p in paths:
    if not p.exists(): continue
    s=p.read_text()
    s=s.replace('proxy_set_header Host \\$host;', 'proxy_set_header Host cdn-origin.panelsu.ru;')
    s=s.replace('proxy_set_header X-Real-IP \\$remote_addr;', 'proxy_set_header X-Real-IP $remote_addr;')
    s=s.replace('proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;', 'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;')
    s=s.replace('proxy_set_header X-Forwarded-Proto \\$scheme;', 'proxy_set_header X-Forwarded-Proto $scheme;')
    p.write_text(s)
    print('updated', p)
PY
nginx -t
systemctl reload nginx
sleep 1

echo '=== nginx config after ==='
nginx -T 2>/dev/null | sed -n '/location \/twcdn-xhttp/,+14p' | head -30

echo
echo '=== sanity curl after fix ==='
for u in \
  https://cdn-origin.panelsu.ru/twcdn-xhttp/ \
  https://kclxvgxzs7.cdn.twcstorage.ru/twcdn-xhttp/ \
  https://kclxvgxzs7.cdn.twcstorage.ru/twcdn-xhttp/abc; do
  echo "--- $u"
  curl -sS -m 12 -k "$u" -o /tmp/body -w 'code=%{http_code} http=%{http_version} ip=%{remote_ip} time=%{time_total} size=%{size_download}\n' || true
  printf 'body='; head -c 120 /tmp/body; echo
done

echo
echo '=== recent xray errors host/xhttp ==='
tail -80 /usr/local/x-ui/bin/error.log | grep -Ei 'xhttp|host|malformed|failed|request' | tail -40 || true
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',(code)=>{console.log('\nEXIT',code); c.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error('SSH:', e.message); process.exit(1)}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
