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
const cmd = `
set +e
DEBIAN_FRONTEND=noninteractive apt-get -y purge 'cloudflare-warp*' 2>&1 | tail -2
rm -f /usr/bin/warp-cli /usr/bin/warp-svc /etc/apt/sources.list.d/cloudflare-client.list
rm -rf /etc/hysteria /var/lib/hysteria
modprobe tcp_bbr 2>&1
echo 'tcp_bbr' > /etc/modules-load.d/bbr.conf
sysctl -w net.core.default_qdisc=fq
sysctl -w net.ipv4.tcp_congestion_control=bbr
sysctl --system 2>&1 | tail -2
echo '--final--'
sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc
which warp-cli warp-svc 2>&1
ls /etc/hysteria 2>&1
systemctl is-active x-ui
ss -lntp | grep -E ':2080|:8443'
sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,port,protocol,enable FROM inbounds;"
`;
for(let i=0;i<10;i++){
  const r=await ssh(cmd,100000);
  if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]')){console.log(`OK try ${i+1}\n${r}`);process.exit(0)}
  console.log(`try ${i+1}: ${r.slice(0,60)}`);
  await new Promise(r=>setTimeout(r,4000));
}
console.log('FAILED');
