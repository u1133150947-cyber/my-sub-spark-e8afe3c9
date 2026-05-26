import { Client } from 'ssh2';
const script = `cat > /tmp/cascadeadd.ts << 'TS'
import { listInbounds, panelFetch } from "/opt/sub-manager/server/x3ui.ts";
const UUID = "2a56beab-d0f7-48d8-bb2e-faf23fb282b4";
const EMAIL = "cascade-ru-in";
const SLUGS = ["pff0c43257d","p53180a1f7a","p37e03ed4b0"];
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
    // Try JSON body (new 3X-UI)
    const tries = [
      {ct:"application/json", body: JSON.stringify({id:v.id, settings})},
      {ct:"application/x-www-form-urlencoded", body:"id="+v.id+"&settings="+encodeURIComponent(settings)},
    ];
    for (const t of tries) {
      try {
        const res = await panelFetch(slug, "/panel/api/inbounds/addClient", {
          method:"POST",
          headers:{"Content-Type":t.ct},
          body:t.body,
        });
        console.log(slug, t.ct, "->", res.status, res.body.slice(0,300));
        if (res.status===200) break;
      } catch(ee:any) {
        console.log(slug, t.ct, "EXC:", ee.message);
      }
    }
  } catch(e:any){ console.log(slug,"ERR:",e.message); }
}
TS
cd /opt/sub-manager && deno run -A --unstable-kv --env=/opt/sub-manager/.env /tmp/cascadeadd.ts 2>&1`;
const c = new Client();
c.on('ready',()=>c.exec(script,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD!,readyTimeout:15000});
