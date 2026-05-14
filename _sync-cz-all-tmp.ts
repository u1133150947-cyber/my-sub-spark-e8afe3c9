import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string,timeout=120000){
  return new Promise<string>((resolve)=>{
    const c=new Client(); let o='';
    const tm=setTimeout(()=>{try{c.end()}catch{};resolve(o+'\n[TIMEOUT]')},timeout);
    c.on('ready',()=>c.exec(cmd,(e,s)=>{
      if(e){clearTimeout(tm);resolve('ERR:'+e.message);return}
      s.on('close',()=>{clearTimeout(tm);c.end();resolve(o)})
       .on('data',(d:any)=>o+=d.toString()).stderr.on('data',(d:any)=>o+=d.toString());
    })).on('error',e=>{clearTimeout(tm);resolve('SSH:'+e.message)})
     .connect({host,port:22,username:'root',password:pw,readyTimeout:45000,keepaliveInterval:3000});
  });
}
async function retry(cmd:string,host:string,pw:string,n=8){
  for(let i=0;i<n;i++){
    const r=await ssh(host,pw,cmd,90000);
    if(!r.startsWith('SSH:')&&!r.includes('[TIMEOUT]'))return r;
    await new Promise(r=>setTimeout(r,3000+i*2000));
  }
  return '[FAIL]';
}

// 1. Get current CZ inbound config from CZ server
console.log('=== CZ INBOUND ===');
const czInb = await retry(`sqlite3 /etc/x-ui/x-ui.db "SELECT id||'|'||remark||'|'||port||'|'||protocol||'|'||stream_settings||'|'||settings FROM inbounds WHERE enable=1;"`,'185.87.148.138','hf6Ka8viMl');
console.log(czInb);

// 2. Get RU app.db state  
console.log('\n=== RU APP DB - subscriptions and CZ inbounds ===');
const ruState = await retry(`
sqlite3 /opt/sub-manager/data/app.db <<SQL
.headers on
.mode column
SELECT name FROM sqlite_master WHERE type='table';
SELECT '--- panels ---';
SELECT id, slug, name, host, panel_url FROM panels;
SELECT '--- subscriptions count ---';
SELECT COUNT(*) FROM subscriptions;
SELECT '--- subscriptions sample ---';
SELECT id, slug, client_email FROM subscriptions LIMIT 20;
SELECT '--- subscription_inbounds by panel ---';
SELECT panel, COUNT(*) FROM subscription_inbounds GROUP BY panel;
SELECT '--- CZ inbounds detail ---';
SELECT subscription_id, panel, inbound_id, remark, port, protocol, host FROM subscription_inbounds WHERE panel LIKE '%cz%' OR panel LIKE 'pcd%' LIMIT 30;
SQL
`,'82.202.128.147','K!E2QAGrxYFx');
console.log(ruState);
