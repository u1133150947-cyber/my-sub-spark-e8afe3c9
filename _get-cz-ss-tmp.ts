import { Client } from 'ssh2';
function run(host:string,pw:string,cmd:string,timeout=90000){
  return new Promise<string>((resolve)=>{
    const c=new Client(); let o='';
    const tm=setTimeout(()=>{try{c.end()}catch{};resolve(o+'\n[TIMEOUT]')},timeout);
    c.on('ready',()=>c.exec(cmd,(e,s)=>{
      if(e){clearTimeout(tm);resolve('ERR:'+e.message);return}
      s.on('close',()=>{clearTimeout(tm);c.end();resolve(o)})
       .on('data',(d:any)=>o+=d.toString()).stderr.on('data',(d:any)=>o+=d.toString());
    })).on('error',e=>{clearTimeout(tm);resolve('SSH:'+e.message)})
     .connect({host,port:22,username:'root',password:pw,readyTimeout:30000,keepaliveInterval:3000});
  });
}
for(let i=0;i<10;i++){
  const r=await run('185.87.148.138','hf6Ka8viMl',`sqlite3 /etc/x-ui/x-ui.db "SELECT stream_settings FROM inbounds WHERE id=28;" && echo '---SETTINGS---' && sqlite3 /etc/x-ui/x-ui.db "SELECT settings FROM inbounds WHERE id=28;"`);
  if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]')){console.log(r);process.exit(0)}
  console.log(`try ${i+1}: ${r.slice(0,60)}`);
  await new Promise(r=>setTimeout(r,4000));
}
