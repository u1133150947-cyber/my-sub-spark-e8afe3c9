import { Client } from 'ssh2';
const c=new Client();
const SCRIPT = String.raw`
set -e
echo '=== nginx + stream module ==='
which nginx || apt-get install -y nginx
nginx -V 2>&1 | grep -o 'with-stream' || { apt-get install -y libnginx-mod-stream; }
echo '--- modules ---'; ls /etc/nginx/modules-enabled/ 2>/dev/null

echo '=== backup db ==='
cp /etc/x-ui/x-ui.db /etc/x-ui/x-ui.db.bak-snimux-$(date +%s)

echo '=== rewrite inbounds via python ==='
python3 <<'PY'
import sqlite3, json, copy
db='/etc/x-ui/x-ui.db'
con=sqlite3.connect(db); cur=con.cursor()
cur.execute("SELECT id,user_id,up,down,total,remark,enable,expiry_time,listen,port,protocol,settings,stream_settings,tag,sniffing,allocate FROM inbounds WHERE port=8443")
row=cur.fetchone()
if not row:
    print("no 8443 inbound"); raise SystemExit(1)
cols=['id','user_id','up','down','total','remark','enable','expiry_time','listen','port','protocol','settings','stream_settings','tag','sniffing','allocate']
src=dict(zip(cols,row))
print("base id",src['id'],"tag",src['tag'])

ss=json.loads(src['stream_settings'])
# normalize: single serverName per inbound
mapping=[
  ('cz','ya.ru',          18443),
  ('de','dzen.ru',        18444),
  ('fi','mail.yandex.ru', 18445),
  ('se','market.yandex.ru',18446),
]
# delete old 8443 and any old per-country
cur.execute("DELETE FROM inbounds WHERE port IN (8443,18443,18444,18445,18446)")
cur.execute("DELETE FROM client_traffics WHERE inbound_id NOT IN (SELECT id FROM inbounds)")
# sniffing disabled (we do not want inner sniff to drive routing)
sniff=json.dumps({"enabled":False,"destOverride":["http","tls","quic"],"metadataOnly":False,"routeOnly":False})
for cc,sni,port in mapping:
    ns=copy.deepcopy(ss)
    ns['realitySettings']['serverNames']=[sni]
    # dest must match sni
    ns['realitySettings']['dest']=f"{sni}:443"
    tag=f"inbound-{cc}"
    cur.execute("""INSERT INTO inbounds(user_id,up,down,total,remark,enable,expiry_time,listen,port,protocol,settings,stream_settings,tag,sniffing,allocate)
                   VALUES (?,0,0,0,?,1,0,?,?,?,?,?,?,?,?)""",
                (src['user_id'],f"ru-cascade-{cc}","127.0.0.1",port,src['protocol'],src['settings'],json.dumps(ns),tag,sniff,src['allocate']))
    iid=cur.lastrowid
    # add client_traffics from settings
    s=json.loads(src['settings'])
    for cl in s.get('clients',[]):
        cur.execute("INSERT INTO client_traffics(inbound_id,enable,email,up,down,expiry_time,total,reset) VALUES (?,1,?,0,0,0,0,0)",
                    (iid, cl.get('email','')+'-'+cc))
    print(f"  created {tag} on 127.0.0.1:{port} sni={sni}")

# update template routing
cur.execute("SELECT value FROM settings WHERE key='xrayTemplateConfig'")
tpl=json.loads(cur.fetchone()[0])
# replace routing rules for inbound-8443 with per-country rules
new_rules=[r for r in tpl['routing']['rules'] if 'inbound-8443' not in (r.get('inboundTag') or [])]
# api rule first
api=[r for r in new_rules if (r.get('inboundTag') or [])==['api']]
rest=[r for r in new_rules if (r.get('inboundTag') or [])!=['api']]
country_rules=[
  {"type":"field","inboundTag":["inbound-cz"],"outboundTag":"cascade-cz"},
  {"type":"field","inboundTag":["inbound-de"],"outboundTag":"cascade-de"},
  {"type":"field","inboundTag":["inbound-fi"],"outboundTag":"cascade-fi"},
  {"type":"field","inboundTag":["inbound-se"],"outboundTag":"cascade-se"},
]
tpl['routing']['rules']=api+country_rules+rest
cur.execute("UPDATE settings SET value=? WHERE key='xrayTemplateConfig'", (json.dumps(tpl),))
con.commit()
print("template routing updated")
con.close()
PY

echo '=== nginx stream config ==='
cat > /etc/nginx/modules-enabled/10-stream-sni.conf <<'NG'
load_module modules/ngx_stream_module.so;
NG

# remove old stream config from main if any
mkdir -p /etc/nginx/stream.d
cat > /etc/nginx/stream-sni.conf <<'NG'
stream {
  map $ssl_preread_server_name $upstream_port {
    ya.ru            18443;
    dzen.ru          18444;
    mail.yandex.ru   18445;
    market.yandex.ru 18446;
    default          18443;
  }
  server {
    listen 0.0.0.0:8443;
    proxy_pass 127.0.0.1:$upstream_port;
    ssl_preread on;
    proxy_timeout 300s;
  }
}
NG

# include from main nginx.conf if not present
grep -q 'stream-sni.conf' /etc/nginx/nginx.conf || echo 'include /etc/nginx/stream-sni.conf;' >> /etc/nginx/nginx.conf

# remove the load_module line (it's already loaded via modules-enabled)
sed -i '/load_module modules\/ngx_stream_module.so;/d' /etc/nginx/nginx.conf 2>/dev/null || true

echo '=== test nginx ==='
nginx -t

echo '=== restart x-ui + nginx ==='
systemctl restart x-ui
sleep 3
systemctl restart nginx
sleep 2

echo '=== listeners ==='
ss -lntp | grep -E ':(8443|18443|18444|18445|18446) '
echo '=== x-ui status ==='
systemctl is-active x-ui
echo '=== nginx status ==='
systemctl is-active nginx
echo '=== xray error tail ==='
tail -30 /usr/local/x-ui/error.log 2>/dev/null
`;
c.on('ready',()=>c.exec(SCRIPT,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.on('error',e=>console.error('ERR',e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
