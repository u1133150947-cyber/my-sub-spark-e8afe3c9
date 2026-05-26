import { Client } from 'ssh2';
const pw = process.env.RU_SSH_PASSWORD!;
const CMD = `
echo '=== nginx.conf includes ==='
grep -n 'stream-sni\\|include' /etc/nginx/nginx.conf
echo '=== context around include ==='
grep -n -B5 -A5 'stream-sni' /etc/nginx/nginx.conf
echo '=== backup file content ==='
ls -la /etc/nginx/stream-sni.conf.bak.* | head -1
BAK=$(ls -t /etc/nginx/stream-sni.conf.bak.* | head -1)
echo "BAK=$BAK"
cat "$BAK"
`;
await new Promise<void>(r=>{const c=new Client();
 c.on('ready',()=>c.exec(CMD,(e,s)=>{if(e){console.error(e);r();return}
  s.on('close',()=>{c.end();r()}).on('data',(d:any)=>process.stdout.write(d)).stderr.on('data',(d:any)=>process.stderr.write(d))}))
 .on('error',(e:any)=>{console.error(e.message);r()})
 .connect({host:'ru.panelsu.ru',port:22,username:'root',password:pw,readyTimeout:15000});});
