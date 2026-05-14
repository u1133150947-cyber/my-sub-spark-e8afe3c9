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
    if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]')){console.log(`### ${label} (${i+1}) ###\n${r}\n`);return r}
    console.log(`[${label}] retry ${i+1}: ${r.slice(0,80)}`);
    await new Promise(r=>setTimeout(r,4000+i*2000));
  }
  return '';
}

// Kill leftovers (h-ui, hysteria leftovers, nginx)
await retry(`
set +e
systemctl stop nginx h-ui hysteria 2>&1 | tail -5
systemctl disable nginx h-ui hysteria 2>&1 | tail -5
pkill -9 -f h-ui; pkill -9 -f hysteria
DEBIAN_FRONTEND=noninteractive apt-get -y purge nginx nginx-common nginx-core 2>&1 | tail -3
rm -rf /etc/nginx /var/log/nginx /usr/local/h-ui /etc/h-ui /opt/h-ui /etc/systemd/system/h-ui.service /etc/systemd/system/hysteria*.service
rm -rf /usr/local/bin/h-ui /usr/local/bin/hysteria
systemctl daemon-reload
echo '--- ports ---'
ss -lntp
echo 'DONE-CLEAN2'
`,'CLEAN2',60000);

// Install 3x-ui v2.6.7 with auto-input
// v2.6.7 install.sh prompts: y to set custom config, then username, password, port, web base path
await retry(`
export DEBIAN_FRONTEND=noninteractive
cd /tmp
curl -fsSL https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh -o /tmp/3xui.sh
chmod +x /tmp/3xui.sh
printf 'y\nadmin_cz\nCzPanel2026!Strong\n2053\nczpanel\n' | /tmp/3xui.sh v2.6.7 2>&1 | tail -60
echo 'DONE-INSTALL'
`,'INSTALL',300000);

await retry(`
echo '--- service ---'
systemctl is-active x-ui
systemctl status x-ui --no-pager | head -10
echo '--- settings ---'
/usr/local/x-ui/x-ui setting -show 2>&1
echo '--- ports ---'
ss -lntp | grep -E ':2053|:80|:443'
`,'VERIFY',60000);
