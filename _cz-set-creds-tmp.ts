import { Client } from 'ssh2';
function ssh(cmd:string,timeout=120000){
  return new Promise<string>((resolve)=>{
    const c=new Client(); let o='';
    const tm=setTimeout(()=>{try{c.end()}catch{};resolve(o+'\n[TIMEOUT]')},timeout);
    c.on('ready',()=>c.exec(cmd,(e,s)=>{
      if(e){clearTimeout(tm);resolve('ERR:'+e.message);return}
      s.on('close',()=>{clearTimeout(tm);c.end();resolve(o)})
       .on('data',(d:any)=>o+=d.toString()).stderr.on('data',(d:any)=>o+=d.toString());
    })).on('error',e=>{clearTimeout(tm);resolve('SSH:'+e.message)})
     .connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:60000,keepaliveInterval:3000});
  });
}
async function retry(cmd:string,label:string){
  for(let i=0;i<10;i++){
    const r=await ssh(cmd,90000);
    if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]')){console.log(`### ${label} ###\n${r}`);return r}
    console.log(`[${label}] retry ${i+1}: ${r.slice(0,60)}`);
    await new Promise(r=>setTimeout(r,4000));
  }
  return '';
}

await retry(`
set +e
/usr/local/x-ui/x-ui setting -username admin_cz -password 'CzPanel2026Strong' -port 2053 -webBasePath czpanel 2>&1
echo '---'
/usr/local/x-ui/x-ui setting -show 2>&1
echo '---restart---'
systemctl restart x-ui
sleep 2
systemctl is-active x-ui
ss -lntp | grep -E ':2053|:80|:443'
echo '---test http---'
curl -sk -o /dev/null -w 'http=%{http_code}\n' https://127.0.0.1:2053/czpanel/
`,'CONFIGURE');
