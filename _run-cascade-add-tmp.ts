import { Client } from 'ssh2';
const script = `cat > /tmp/cascadeadd.ts << 'TS'
import { listInbounds, panelFetch } from "/opt/sub-manager/server/x3ui.ts";
const UUID = "2a56beab-d0f7-48d8-bb2e-faf23fb282b4";
const EMAIL = "cascade-ru-in";
const SLUGS = ["pd7fa18ab53","p2c70200bad","pc58a3d687d"];
for (const slug of SLUGS) {
  try {
    const ibs = await listInbounds(slug);
    const v = ibs.find((i:any)=>i.protocol==="vless");
    if (!v) { console.log(slug,"NO VLESS"); continue; }
    console.log(slug,"ib=",v.id,"port=",v.port,"remark=",v.remark);
    // check existing
    let st:any={}; try{st=JSON.parse(v.settings||"{}");}catch{}
    const has = (st.clients||[]).find((c:any)=>c.id===UUID||c.email===EMAIL);
    if (has) { console.log(slug,"already has client",has.email); continue; }
    const settings = JSON.stringify({clients:[{id:UUID,flow:"xtls-rprx-vision",email:EMAIL,limitIp:0,totalGB:0,expiryTime:0,enable:true,tgId:"",subId:"",reset:0}]});
    const res = await panelFetch(slug, "/panel/api/inbounds/addClient", {
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:"id="+v.id+"&settings="+encodeURIComponent(settings),
    });
    console.log(slug,"addClient:",res.status,res.body.slice(0,300));
  } catch(e:any){ console.log(slug,"ERR:",e.message); }
}
TS
cd /opt/sub-manager && deno run -A --unstable-kv --env=/opt/sub-manager/.env /tmp/cascadeadd.ts 2>&1`;
const c = new Client();
c.on('ready',()=>c.exec(script,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});
