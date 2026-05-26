import { Client } from 'ssh2';
const script = `cat > /tmp/cascadefix.ts << 'TS'
import { listInbounds, updateInbound } from "/opt/sub-manager/server/x3ui.ts";
const CORRECT_UUID = "35f80dac-2368-4548-b435-5ad364b9e604";
const WRONG_UUID = "2a56beab-d0f7-48d8-bb2e-faf23fb282b4";
const EMAIL = "cascade-ru-in";
const SLUGS = ["pff0c43257d","p53180a1f7a","p37e03ed4b0","pcz459eb7d5"];
for (const slug of SLUGS) {
  try {
    const ibs = await listInbounds(slug);
    const v = ibs.find((i:any)=>i.protocol==="vless");
    if (!v) { console.log(slug,"NO VLESS"); continue; }
    let st:any={}; try{st=JSON.parse(v.settings||"{}");}catch{}
    const clients = Array.isArray(st.clients) ? st.clients : [];
    console.log(slug,"existing clients:", clients.map((c:any)=>({id:c.id,email:c.email})));
    // remove wrong UUID if present
    let changed=false;
    const filtered = clients.filter((c:any)=>{
      if (c.id===WRONG_UUID) { changed=true; return false; }
      return true;
    });
    // check if correct UUID already exists
    const has = filtered.find((c:any)=>c.id===CORRECT_UUID);
    if (!has) {
      filtered.push({id:CORRECT_UUID,flow:"xtls-rprx-vision",email:EMAIL,limitIp:0,totalGB:0,expiryTime:0,enable:true,tgId:"",subId:"",reset:0});
      changed=true;
    }
    if (!changed) { console.log(slug,"OK (already correct)"); continue; }
    st.clients = filtered;
    const r = await updateInbound(slug, v.id, {...v, settings: JSON.stringify(st)});
    console.log(slug,"updated:", r.success ?? r);
  } catch(e:any){ console.log(slug,"ERR:", e.message); }
}
TS
cd /opt/sub-manager && deno run -A --unstable-kv --env=/opt/sub-manager/.env /tmp/cascadefix.ts 2>&1`;
const c = new Client();
c.on('ready',()=>c.exec(script,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD!,readyTimeout:15000});
