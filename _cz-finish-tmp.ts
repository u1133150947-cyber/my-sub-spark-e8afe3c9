import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string,timeout=180000){
  return new Promise<string>((resolve)=>{
    const c=new Client(); let o='';
    const tm=setTimeout(()=>{try{c.end()}catch{};resolve(o+'\n[TIMEOUT]')},timeout);
    c.on('ready',()=>c.exec(cmd,(e,s)=>{
      if(e){clearTimeout(tm);resolve('ERR:'+e.message);return}
      s.on('close',()=>{clearTimeout(tm);c.end();resolve(o)})
       .on('data',(d:any)=>o+=d.toString())
       .stderr.on('data',(d:any)=>o+=d.toString());
    })).on('error',e=>{clearTimeout(tm);resolve('SSH:'+e.message)})
     .connect({host,port:22,username:'root',password:pw,readyTimeout:30000,keepaliveInterval:5000});
  });
}

async function retry<T>(fn:()=>Promise<string>,label:string,n=5):Promise<string>{
  for(let i=0;i<n;i++){
    const r=await fn();
    if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]')){console.log(`[${label}] ok try ${i+1}`);return r}
    console.log(`[${label}] retry ${i+1}: ${r.slice(0,80)}`);
    await new Promise(r=>setTimeout(r,3000*(i+1)));
  }
  return '[FAILED ALL RETRIES]';
}

const CZ='185.87.148.138', PW='hf6Ka8viMl';

console.log('=== STEP 1: PING TEST FROM HERE ===');
const { execSync } = await import('child_process');
try{ console.log(execSync('ping -c 5 -W 2 185.87.148.138',{encoding:'utf8'})); }catch(e:any){ console.log(e.stdout||e.message); }

console.log('\n=== STEP 2: CLEANUP WARP+HYSTERIA, ENABLE BBR ===');
const cleanup = `
set +e
echo '--warp purge--'
systemctl stop warp-svc 2>&1 | head -2
systemctl disable warp-svc 2>&1 | head -2
warp-cli --accept-tos disconnect 2>&1 | head -2
pkill -9 -f warp 2>/dev/null
DEBIAN_FRONTEND=noninteractive apt-get -y purge 'cloudflare-warp*' 2>&1 | tail -3
rm -f /etc/apt/sources.list.d/cloudflare-client.list
echo '--hysteria purge--'
systemctl stop hysteria-server hysteria 2>&1 | head -2
systemctl disable hysteria-server hysteria 2>&1 | head -2
rm -f /etc/systemd/system/hysteria*.service /usr/local/bin/hysteria
rm -rf /etc/hysteria
systemctl daemon-reload
echo '--bbr--'
cat > /etc/sysctl.d/99-bbr.conf <<EOL
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.core.rmem_max=67108864
net.core.wmem_max=67108864
net.ipv4.tcp_rmem=4096 87380 67108864
net.ipv4.tcp_wmem=4096 65536 67108864
net.ipv4.tcp_mtu_probing=1
EOL
sysctl --system 2>&1 | tail -3
echo '--restart x-ui--'
systemctl restart x-ui
sleep 2
echo 'DONE'
`;
console.log(await retry(()=>ssh(CZ,PW,cleanup,120000),'cleanup'));

console.log('\n=== STEP 3: VERIFY ===');
const verify = `
echo '--bbr--'; sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc
echo '--warp--'; systemctl is-active warp-svc 2>&1; which warp-cli 2>&1
echo '--hysteria--'; systemctl is-active hysteria-server 2>&1; ls /etc/hysteria 2>&1
echo '--x-ui--'; systemctl is-active x-ui
echo '--ports--'; ss -lntp | grep -E ':2080|:8443|:443'
echo '--inbounds--'; sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,port,protocol,enable FROM inbounds;"
echo '--ping out--'; ping -c 3 -W 2 1.1.1.1 | tail -2
echo '--curl--'; curl -s --max-time 8 -o /dev/null -w 'http=%{http_code} t=%{time_total}\n' https://www.cloudflare.com/cdn-cgi/trace
`;
console.log(await retry(()=>ssh(CZ,PW,verify,60000),'verify'));
