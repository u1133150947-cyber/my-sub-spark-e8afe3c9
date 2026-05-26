import { Client } from 'ssh2';
import { createClient } from '@supabase/supabase-js';
const SUPA_URL='https://tyflywtpmeaqldzaoraj.supabase.co';
const SR=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supa=createClient(SUPA_URL, SR);

// Fetch current sub + its existing inbound row to use as template
const SUB_ID='550507aa-9960-4441-9cde-278c94974b24';
const { data: sub } = await supa.from('subscriptions').select('*').eq('id',SUB_ID).single();
const { data: existing } = await supa.from('subscription_inbounds').select('*').eq('subscription_id',SUB_ID);
console.log('sub.client_email=',sub!.client_email,'uuid=',sub!.client_uuid);
console.log('existing inbounds:', existing!.map((r:any)=>({id:r.inbound_id,remark:r.remark,port:r.port})));

// Pull RU inbounds 8/9/10/11 from RU x-ui DB to mirror stream_settings
const sh=`sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,remark,port,protocol,stream_settings FROM inbounds WHERE id IN (8,9,10,11);"`;
const data:any[] = await new Promise((res)=>{
  const c=new Client();
  let out='';
  c.on('ready',()=>c.exec(sh,(e,s)=>{s.on('close',()=>{c.end();res(JSON.parse(out||'[]'))}).on('data',(d:any)=>out+=d.toString())}))
  .connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:15000});
});
console.log('ru inbounds fetched:', data.map(r=>({id:r.id,remark:r.remark,port:r.port})));

// For each, ensure (a) client exists on RU xray with sub.client_uuid; (b) subscription_inbounds row exists.
const seen = new Set(existing!.map((r:any)=>r.inbound_id));
const toInsert:any[]=[];
for (const r of data) {
  const ss = JSON.parse(r.stream_settings);
  if (seen.has(r.id)) { console.log('  skip existing inbound',r.id); continue; }
  toInsert.push({
    subscription_id: SUB_ID,
    panel: 'ru',
    inbound_id: r.id,
    remark: r.remark,
    protocol: r.protocol,
    port: r.port,
    host: 'ru.panelsu.ru',
    stream_settings: ss,
    client_email: sub!.client_email,
    sort_order: r.id,
  });
}
if (toInsert.length){
  const { error } = await supa.from('subscription_inbounds').insert(toInsert);
  if (error) { console.error('insert err',error); process.exit(1); }
  console.log('inserted subscription_inbounds for ids:', toInsert.map(t=>t.inbound_id));
}

// Now add client to each RU inbound's x-ui settings if missing
const NEEDED_UUID = sub!.client_uuid;
const NEEDED_EMAIL = sub!.client_email; // used as base
const sh2 = `
python3 <<'PY'
import sqlite3, json
db='/etc/x-ui/x-ui.db'
con=sqlite3.connect(db); cur=con.cursor()
target_uuid="${NEEDED_UUID}"
base_email="${NEEDED_EMAIL}"
for iid, suffix in [(8,'cz'),(9,'de'),(10,'fi'),(11,'se')]:
    row=cur.execute("SELECT settings FROM inbounds WHERE id=?",(iid,)).fetchone()
    if not row: continue
    s=json.loads(row[0])
    cls=s.get('clients',[])
    if any(c.get('id')==target_uuid for c in cls):
        print(f'  uuid present in inbound {iid}'); continue
    new_email=f"{base_email}_ru{iid}"
    cls.append({"id":target_uuid,"email":new_email,"flow":"xtls-rprx-vision","enable":True,"limitIp":0,"totalGB":0,"expiryTime":0,"reset":0,"subId":"","tgId":""})
    s['clients']=cls
    cur.execute("UPDATE inbounds SET settings=? WHERE id=?",(json.dumps(s),iid))
    cur.execute("INSERT INTO client_traffics(inbound_id,enable,email,up,down,expiry_time,total,reset) VALUES (?,1,?,0,0,0,0,0)",(iid,new_email))
    print(f'  added uuid to inbound {iid} email {new_email}')
con.commit(); con.close()
PY
systemctl restart x-ui
sleep 3
systemctl is-active x-ui
`;
await new Promise<void>(res=>{
  const c=new Client();
  c.on('ready',()=>c.exec(sh2,(e,s)=>{s.on('close',()=>{c.end();res()}).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))}))
  .connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:15000});
});
