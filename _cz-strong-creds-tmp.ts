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
async function retry(cmd:string){
  for(let i=0;i<15;i++){
    const r=await ssh(cmd,90000);
    if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]')){console.log(r);return r}
    console.log(`retry ${i+1}: ${r.slice(0,80)}`);
    await new Promise(r=>setTimeout(r,4000));
  }
  return '';
}
const U='cz_admin_x9K';
const P='Tz7$mQv2Lp8Wn4Rg!Hd';
const PATH='czpanel_a7f3k9';
await retry(`
set +e
/usr/local/x-ui/x-ui setting -username '${U}' -password '${P}' -port 2053 -webBasePath '${PATH}' 2>&1
echo '---show---'
/usr/local/x-ui/x-ui setting -show 2>&1 | grep -iE 'username|password|port|webBasePath|listen'
systemctl restart x-ui
sleep 3
systemctl is-active x-ui
echo '---http---'
curl -sk -o /dev/null -w 'code=%{http_code}\n' https://127.0.0.1:2053/${PATH}/
`);
