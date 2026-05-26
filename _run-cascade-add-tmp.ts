import { Client } from 'ssh2';
const script = `cat > /tmp/cascadeadd.ts << 'TS'
import { listInbounds, updateInbound } from "/opt/sub-manager/server/x3ui.ts";
const UUID = "2a56beab-d0f7-48d8-bb2e-faf23fb282b4";
const EMAIL = "cascade-ru-in";
const SLUGS = ["pff0c43257d","p53180a1f7a","p37e03ed4b0"];
for (const slug of SLUGS) {
  try {
    const ibs = await listInbounds(slug);
    const v = ibs.find((i:any)=>i.protocol==="vless");
    if (!v) { console.log(slug,"NO VLESS"); continue; }
    console.log(slug,"ib=",v.id,"port=",v.port,"remark=",v.remark);
    let st:any={}; try{st=JSON.parse(v.settings||"{}");}catch{}
    const clients = Array.isArray(st.clients) ? st.clients : [];
    const idx = clients.findIndex((c:any)=>c.id===UUID||c.email===EMAIL);
    const newClient = {id:UUID,flow:"xtls-rprx-vision",email:EMAIL,limitIp:0,totalGB:0,expiryTime:0,enable:true,tgId:"",subId:"",reset:0};
    if (idx>=0) { console.log(slug,"already present, skipping"); continue; }
    clients.push(newClient);
    st.clients = clients;
    try {
      const r = await updateInbound(slug, v.id, {...v, settings: JSON.stringify(st)});
      console.log(slug,"updateInbound OK", JSON.stringify(r).slice(0,200));
    } catch(ee:any){ console.log(slug,"updateInbound ERR:", ee.message); }
  } catch(e:any){ console.log(slug,"ERR:", e.message); }
}
TS
cd /opt/sub-manager && deno run -A --unstable-kv --env=/opt/sub-manager/.env /tmp/cascadeadd.ts 2>&1`;
const c = new Client();
c.on('ready',()=>c.exec(script,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD!,readyTimeout:15000});
