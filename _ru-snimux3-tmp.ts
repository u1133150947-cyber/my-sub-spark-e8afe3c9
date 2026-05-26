import { Client } from 'ssh2';
const c=new Client();
const SCRIPT = String.raw`
set -e
python3 <<'PY'
import sqlite3, json, copy
db='/etc/x-ui/x-ui.db'
con=sqlite3.connect(db); cur=con.cursor()
cur.execute("SELECT id,user_id,remark,enable,expiry_time,listen,port,protocol,settings,stream_settings,tag,sniffing FROM inbounds WHERE port=8443")
row=cur.fetchone()
if not row:
    # maybe already split — pull from any cz remnant
    cur.execute("SELECT id,user_id,remark,enable,expiry_time,listen,port,protocol,settings,stream_settings,tag,sniffing FROM inbounds ORDER BY id LIMIT 1")
    row=cur.fetchone()
cols=['id','user_id','remark','enable','expiry_time','listen','port','protocol','settings','stream_settings','tag','sniffing']
src=dict(zip(cols,row))
ss=json.loads(src['stream_settings'])
mapping=[('cz','ya.ru',18443),('de','dzen.ru',18444),('fi','mail.yandex.ru',18445),('se','market.yandex.ru',18446)]
cur.execute("DELETE FROM inbounds WHERE port IN (8443,18443,18444,18445,18446)")
cur.execute("DELETE FROM client_traffics WHERE inbound_id NOT IN (SELECT id FROM inbounds)")
sniff=json.dumps({"enabled":False,"destOverride":["http","tls","quic"],"metadataOnly":False,"routeOnly":False})
for cc,sni,port in mapping:
    ns=copy.deepcopy(ss)
    ns['realitySettings']['serverNames']=[sni]
    ns['realitySettings']['dest']=f"{sni}:443"
    tag=f"inbound-{cc}"
    cur.execute("""INSERT INTO inbounds(user_id,up,down,total,remark,enable,expiry_time,listen,port,protocol,settings,stream_settings,tag,sniffing)
                   VALUES (?,0,0,0,?,1,0,?,?,?,?,?,?,?)""",
                (src['user_id'],f"ru-cascade-{cc}","127.0.0.1",port,src['protocol'],src['settings'],json.dumps(ns),tag,sniff))
    iid=cur.lastrowid
    s=json.loads(src['settings'])
    for cl in s.get('clients',[]):
        cur.execute("INSERT INTO client_traffics(inbound_id,enable,email,up,down,expiry_time,total,reset) VALUES (?,1,?,0,0,0,0,0)",
                    (iid, cl.get('email','user')+'-'+cc))
    print(f"created {tag} 127.0.0.1:{port} sni={sni}")
cur.execute("SELECT value FROM settings WHERE key='xrayTemplateConfig'")
tpl=json.loads(cur.fetchone()[0])
keep=[r for r in tpl['routing']['rules'] if 'inbound-8443' not in (r.get('inboundTag') or [])]
api=[r for r in keep if (r.get('inboundTag') or [])==['api']]
rest=[r for r in keep if (r.get('inboundTag') or [])!=['api']]
cr=[{"type":"field","inboundTag":[f"inbound-{cc}"],"outboundTag":f"cascade-{cc}"} for cc,_,_ in mapping]
tpl['routing']['rules']=api+cr+rest
cur.execute("UPDATE settings SET value=? WHERE key='xrayTemplateConfig'", (json.dumps(tpl),))
con.commit(); con.close()
print("ok")
PY

# nginx stream
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
grep -q 'stream-sni.conf' /etc/nginx/nginx.conf || echo 'include /etc/nginx/stream-sni.conf;' >> /etc/nginx/nginx.conf

nginx -t
systemctl restart x-ui
sleep 4
systemctl restart nginx
sleep 2
echo '=== listeners ==='
ss -lntp | grep -E ':(8443|18443|18444|18445|18446) '
echo '=== xray error ==='
tail -20 /usr/local/x-ui/error.log 2>/dev/null
echo '=== inbounds ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,tag,listen,port FROM inbounds;"
`;
c.on('ready',()=>c.exec(SCRIPT,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
