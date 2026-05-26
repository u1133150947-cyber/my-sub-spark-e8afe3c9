import { Client } from 'ssh2';
import { writeFileSync, readFileSync, statSync } from 'node:fs';

const RU = { host: '82.202.128.147', username: 'root', password: process.env.RU_SSH_PASSWORD!, readyTimeout: 30000 };
const WEB2 = { host: '150.241.70.207', username: 'root', password: 'MzXsgTR1v4026oAIe', readyTimeout: 30000 };
const TAR_LOCAL = '/tmp/sub-manager-deploy.tar.gz';

function conn(opts:any){ return new Promise<Client>((res,rej)=>{const c=new Client();c.on('ready',()=>res(c)).on('error',rej).connect(opts);}); }
function run(c:Client,cmd:string,quiet=false):Promise<{code:number,out:string,err:string}>{
  return new Promise((res,rej)=>c.exec(cmd,(e,s)=>{
    if(e)return rej(e);
    let out='',err='';
    s.on('data',(d:Buffer)=>{const t=d.toString();out+=t;if(!quiet)process.stdout.write(t);});
    s.stderr.on('data',(d:Buffer)=>{const t=d.toString();err+=t;if(!quiet)process.stderr.write(t);});
    s.on('close',(code:number)=>res({code,out,err}));
  }));
}
function sftpGet(c:Client,remote:string,local:string){return new Promise<void>((res,rej)=>c.sftp((e,sftp)=>{if(e)return rej(e);sftp.fastGet(remote,local,(er)=>er?rej(er):res());}));}
function sftpPut(c:Client,local:string,remote:string){return new Promise<void>((res,rej)=>c.sftp((e,sftp)=>{if(e)return rej(e);sftp.fastPut(local,remote,(er)=>er?rej(er):res());}));}

(async()=>{
  console.log('=== [1/6] Connect RU & read .env tokens ===');
  const ru = await conn(RU);
  const envRaw = (await run(ru,"cat /opt/sub-manager/.env",true)).out;
  const get = (k:string)=>{const m=envRaw.match(new RegExp(`^${k}=(.*)$`,'m'));return m?m[1].trim():'';};
  const ADMIN_BOT_TOKEN = get('ADMIN_BOT_TOKEN');
  const ADMIN_TELEGRAM_ID = get('ADMIN_TELEGRAM_ID');
  console.log('ADMIN_BOT_TOKEN:', ADMIN_BOT_TOKEN?ADMIN_BOT_TOKEN.slice(0,8)+'…(len '+ADMIN_BOT_TOKEN.length+')':'MISSING');
  console.log('ADMIN_TELEGRAM_ID:', ADMIN_TELEGRAM_ID||'(empty)');

  console.log('\n=== [2/6] Create tar on RU ===');
  await run(ru,"cd /opt && tar --exclude=sub-manager/node_modules --exclude=sub-manager/data --exclude=sub-manager/.git --exclude=sub-manager/dist -czf /tmp/sub-manager-src.tar.gz sub-manager && ls -lh /tmp/sub-manager-src.tar.gz");

  console.log('\n=== [3/6] Download tar via SFTP ===');
  await sftpGet(ru,'/tmp/sub-manager-src.tar.gz',TAR_LOCAL);
  console.log('Local size:',statSync(TAR_LOCAL).size);
  await run(ru,"rm -f /tmp/sub-manager-src.tar.gz",true);
  ru.end();

  console.log('\n=== [4/6] Connect web2 & upload tar ===');
  const w2 = await conn(WEB2);
  await run(w2,"mkdir -p /opt && rm -rf /opt/sub-manager-src && mkdir -p /opt/sub-manager-src");
  await sftpPut(w2,TAR_LOCAL,'/tmp/sub-manager-src.tar.gz');
  console.log('Uploaded. Extracting…');
  await run(w2,"tar -xzf /tmp/sub-manager-src.tar.gz -C /opt/ && rm /tmp/sub-manager-src.tar.gz && ls /opt/sub-manager/install.sh && wc -l /opt/sub-manager/install.sh");

  console.log('\n=== [5/6] Run install.sh (DOMAIN=web2.panelsu.ru, clean DB) ===');
  // Wrap install.sh execution with env vars so it's non-interactive.
  // Note: install.sh expects to run from project root, so cd first.
  const escTok = ADMIN_BOT_TOKEN.replace(/'/g,"'\\''");
  const installCmd = `cd /opt/sub-manager && DOMAIN=web2.panelsu.ru ADMIN_BOT_TOKEN='${escTok}' ADMIN_TELEGRAM_ID='${ADMIN_TELEGRAM_ID}' bash install.sh 2>&1`;
  const r = await run(w2,installCmd);
  console.log('\ninstall.sh exit:',r.code);

  console.log('\n=== [6/6] Verify ===');
  await run(w2,"systemctl is-active sub-manager caddy; echo '---'; ss -tlnp | grep -E ':80|:443|:8080'; echo '---'; journalctl -u sub-manager -n 20 --no-pager; echo '---'; journalctl -u caddy -n 30 --no-pager | tail -40");
  w2.end();
  console.log('\n=== DONE ===');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});