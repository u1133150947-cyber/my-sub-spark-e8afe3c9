import { Client } from 'ssh2';
function ssh(cmd:string,timeout=180000){
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
async function retry(cmd:string,label:string,timeout=180000,n=12){
  for(let i=0;i<n;i++){
    const r=await ssh(cmd,timeout);
    if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]')){console.log(`### ${label} (try ${i+1}) ###\n${r}`);return r}
    console.log(`[${label}] retry ${i+1}: ${r.slice(0,80)}`);
    await new Promise(r=>setTimeout(r,4000+i*2000));
  }
  console.log(`[${label}] FAILED ALL`);
  return '';
}

// 1. WIPE everything
await retry(`
set +e
echo '--- stop services ---'
systemctl stop x-ui nginx hysteria-server hysteria warp-svc 2>&1 | tail -5
systemctl disable x-ui nginx hysteria-server hysteria warp-svc 2>&1 | tail -5
echo '--- uninstall x-ui ---'
yes y | x-ui uninstall 2>&1 | tail -5
rm -rf /usr/local/x-ui /etc/x-ui /usr/bin/x-ui /etc/systemd/system/x-ui.service
echo '--- purge nginx warp hysteria ---'
DEBIAN_FRONTEND=noninteractive apt-get -y purge nginx nginx-common nginx-core cloudflare-warp 2>&1 | tail -3
rm -f /usr/bin/warp-cli /usr/bin/warp-svc /etc/apt/sources.list.d/cloudflare-client.list
rm -rf /etc/nginx /var/log/nginx /etc/hysteria /usr/local/bin/hysteria
echo '--- remove acme ---'
rm -rf /root/.acme.sh
systemctl daemon-reload
echo '--- ports after ---'
ss -lntp | head -20
echo 'DONE-WIPE'
`,'WIPE',180000);

// 2. apt update/upgrade
await retry(`
export DEBIAN_FRONTEND=noninteractive
apt-get update 2>&1 | tail -3
apt-get -y -o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold' upgrade 2>&1 | tail -10
apt-get -y autoremove 2>&1 | tail -3
echo 'DONE-UPGRADE'
`,'UPGRADE',300000);
