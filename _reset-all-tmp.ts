import { Client } from 'ssh2';
import { randomBytes } from 'node:crypto';

const RU_PW = process.env.RU_SSH_PASSWORD!;
function genpw(){ return randomBytes(12).toString('base64').replace(/[+/=]/g,'').slice(0,18); }

const endpoints = [
  { slug:'p2c70200bad', name:'FI', host:'31.76.77.237',   sshpw:'LqWp4FK0EdcfkeYjw0UIHbS' },
  { slug:'pc58a3d687d', name:'SE', host:'87.121.105.143', sshpw:'f4OQrEBYUQnEmwkgqPnwDD' },
  { slug:'pd7fa18ab53', name:'DE', host:'de.panelsu.ru',  sshpw:'ObAvtvfpvQFUfSVCXyW99Mdi' },
];

function ssh(host:string, user:string, pw:string, cmd:string): Promise<{out:string,err:string,code:number}>{
  return new Promise(res=>{
    const c=new Client(); let out='',err='',code=0;
    c.on('ready',()=>c.exec(cmd,(e,s)=>{
      if(e){res({out,err:String(e),code:1});return}
      s.on('close',(rc:any)=>{c.end();res({out,err,code:rc??0})})
       .on('data',(d:any)=>out+=d.toString())
       .stderr.on('data',(d:any)=>err+=d.toString());
    }))
    .on('error',(e:any)=>res({out,err:e.message,code:1}))
    .connect({host,port:22,username:user,password:pw,readyTimeout:20000});
  });
}

const newPanelPasswords: Record<string,{user:string,pass:string}> = {};

// === Step 1: reset each endpoint ===
for(const e of endpoints){
  const newPass = genpw();
  newPanelPasswords[e.slug] = { user:'admin', pass:newPass };
  console.log(`\n=== ${e.name} (${e.host}) — wipe inbounds + reset admin password ===`);
  const cmd = `
set -e
systemctl stop x-ui 2>/dev/null || service x-ui stop 2>/dev/null || true
sleep 1
sqlite3 /etc/x-ui/x-ui.db "DELETE FROM inbounds; DELETE FROM client_traffics; DELETE FROM inbound_client_ips;"
echo "--- inbounds after wipe ---"
sqlite3 /etc/x-ui/x-ui.db "SELECT count(*) FROM inbounds;"
# Try x-ui CLI to reset admin password
( echo y | /usr/local/x-ui/x-ui setting -username admin -password '${newPass.replace(/'/g,"'\\''")}' ) 2>&1 | tail -5 || true
systemctl start x-ui 2>/dev/null || service x-ui start 2>/dev/null || /usr/local/x-ui/x-ui &
sleep 2
systemctl is-active x-ui 2>/dev/null || echo "x-ui status: $(pgrep -fa x-ui | head -3)"
`;
  const r = await ssh(e.host,'root',e.sshpw,cmd);
  console.log(r.out); if(r.err) console.error('STDERR:',r.err);
}

// === Step 2: RU server cleanup ===
console.log('\n=== RU cleanup: drop DE/FI/SE inbounds, outbounds, routing, nginx SNI map ===');
const RU_CMD = `
set -e
# Backup
cp /etc/x-ui/x-ui.db /etc/x-ui/x-ui.db.bak.$(date +%s)
cp /etc/nginx/stream-sni.conf /etc/nginx/stream-sni.conf.bak.$(date +%s)

# 1) Remove 3 inbounds (9,10,11) from x-ui DB
sqlite3 /etc/x-ui/x-ui.db "DELETE FROM inbounds WHERE id IN (9,10,11); DELETE FROM client_traffics WHERE inbound_id IN (9,10,11);"
echo '--- inbounds left ---'
sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,port,tag FROM inbounds ORDER BY id;"

# 2) Clean xrayTemplateConfig: drop cascade-de/fi/se outbounds + routing rules for those inboundTags
python3 <<'PY'
import sqlite3,json
db=sqlite3.connect('/etc/x-ui/x-ui.db')
cur=db.cursor()
cur.execute("SELECT value FROM settings WHERE key='xrayTemplateConfig'")
row=cur.fetchone()
cfg=json.loads(row[0])
drop_tags={'cascade-de','cascade-fi','cascade-se'}
drop_inbound_tags={'inbound-de','inbound-fi','inbound-se'}
cfg['outbounds']=[o for o in cfg.get('outbounds',[]) if o.get('tag') not in drop_tags]
rules=cfg.get('routing',{}).get('rules',[])
cfg['routing']['rules']=[r for r in rules if not (set(r.get('inboundTag',[])) & drop_inbound_tags) and r.get('outboundTag') not in drop_tags]
cur.execute("UPDATE settings SET value=? WHERE key='xrayTemplateConfig'", (json.dumps(cfg),))
db.commit(); db.close()
print('cleaned xrayTemplateConfig')
PY

# 3) Rewrite nginx SNI map to keep only ya.ru -> 18443
cat > /etc/nginx/stream-sni.conf <<'NGX'
map $ssl_preread_server_name $sni_backend {
    ya.ru   18443;
    default 18443;
}
NGX
echo '--- new stream-sni.conf ---'
cat /etc/nginx/stream-sni.conf

# 4) Reload services
nginx -t && systemctl reload nginx
systemctl restart x-ui
sleep 3
echo '--- xray listening ---'
ss -lntp 2>/dev/null | grep -E ':(8443|18443|18444|18445|18446|4430) ' || echo '(none of those internal ports)'
echo '--- x-ui status ---'
systemctl is-active x-ui
`;
const ru = await ssh('ru.panelsu.ru','root',RU_PW,RU_CMD);
console.log(ru.out); if(ru.err) console.error('RU STDERR:',ru.err);

console.log('\n=== NEW PANEL PASSWORDS ===');
console.log(JSON.stringify(newPanelPasswords,null,2));
