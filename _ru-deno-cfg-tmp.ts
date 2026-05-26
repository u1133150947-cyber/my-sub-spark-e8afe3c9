import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
echo '=== RU deno.json ==='
cat /opt/sub-manager/deno.json 2>/dev/null || echo NO_DENO_JSON
echo
echo '=== RU deno.jsonc ==='
cat /opt/sub-manager/deno.jsonc 2>/dev/null || echo NO_DENO_JSONC
echo
echo '=== RU node_modules/ssh2 version ==='
cat /opt/sub-manager/node_modules/ssh2/package.json 2>/dev/null | grep '"version"' | head -2
echo
echo '=== RU node_modules listing top-level ==='
ls /opt/sub-manager/node_modules/ 2>/dev/null | wc -l
echo
echo '=== RU server/install.ts imports ==='
head -20 /opt/sub-manager/server/install.ts
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write('E:'+d));}))
.on('error',e=>console.error(e.message))
.connect({host:'82.202.128.147',username:'root',password:process.env.RU_SSH_PASSWORD,readyTimeout:20000});