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
     .connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:45000,keepaliveInterval:3000});
  });
}
const U='cz_admin_x9K';
const P='Tz7$mQv2Lp8Wn4Rg!Hd';
const PATH='czpanel_a7f3k9';
for(let i=0;i<25;i++){
  const r=await ssh(`set +e
/usr/local/x-ui/x-ui setting -username '${U}' -password '${P}' -port 2053 -webBasePath '${PATH}' 2>&1 | tail -20
echo '---show---'
/usr/local/x-ui/x-ui setting -show 2>&1 | grep -iE 'username|password|port|webBasePath|listen' | head -20
systemctl restart x-ui
sleep 3
echo 'active='$(systemctl is-active x-ui)
curl -sk -o /dev/null -w 'http_root=%{http_code} ' https://127.0.0.1:2053/
curl -sk -o /dev/null -w 'http_path=%{http_code}\n' https://127.0.0.1:2053/${PATH}/
`,75000);
  if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]')){console.log(r);process.exit(0)}
  console.log(`retry ${i+1}: ${r.slice(0,60)}`);
  await new Promise(r=>setTimeout(r,3000));
}
console.log('FAILED after retries');
