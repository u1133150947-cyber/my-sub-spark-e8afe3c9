import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string,timeout=120000){
  return new Promise<string>((resolve)=>{
    const c=new Client(); let o='';
    const tm=setTimeout(()=>{try{c.end()}catch{};resolve(o+'\n[TIMEOUT]')},timeout);
    c.on('ready',()=>c.exec(cmd,(e,s)=>{
      if(e){clearTimeout(tm);resolve('ERR:'+e.message);return}
      s.on('close',()=>{clearTimeout(tm);c.end();resolve(o)})
       .on('data',(d:any)=>o+=d.toString())
       .stderr.on('data',(d:any)=>o+=d.toString());
    })).on('error',e=>{clearTimeout(tm);resolve('SSH:'+e.message)})
     .connect({host,port:22,username:'root',password:pw,readyTimeout:45000,keepaliveInterval:3000});
  });
}
const verify = `
echo '--bbr--'; sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc 2>&1
echo '--warp--'; systemctl is-active warp-svc 2>&1; which warp-cli warp-svc 2>&1
echo '--hysteria--'; systemctl is-active hysteria-server 2>&1; ls /etc/hysteria 2>&1
echo '--x-ui--'; systemctl is-active x-ui
echo '--ports--'; ss -lntp | grep -E ':2080|:8443|:443'
echo '--inbounds--'; sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,port,protocol,enable FROM inbounds;"
echo '--curl out--'; curl -s --max-time 8 -o /dev/null -w 'http=%{http_code} t=%{time_total}\n' https://www.cloudflare.com/cdn-cgi/trace
echo '--ping panel--'; curl -s --max-time 5 -o /dev/null -w 'sub=%{http_code} t=%{time_total}\n' https://web.panelsu.ru/
`;
for(let i=0;i<15;i++){
  const r=await ssh('185.87.148.138','hf6Ka8viMl',verify,90000);
  if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]')){console.log(`OK try ${i+1}\n${r}`);process.exit(0)}
  console.log(`try ${i+1}: ${r.slice(0,60)}`);
  await new Promise(r=>setTimeout(r,5000));
}
console.log('ALL FAILED - server unreachable from this host');
