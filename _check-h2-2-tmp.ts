import { Client } from 'ssh2';
function run(host:string,pw:string,cmd:string){return new Promise<void>(res=>{const c=new Client();c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>{c.end();res();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error(host,e.message);res();}).connect({host,port:22,username:'root',password:pw,readyTimeout:15000});});}
const cmd = `echo '== inbounds =='; sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,remark,port,protocol FROM inbounds;"; echo; echo '== H2 svc =='; systemctl is-active hysteria-server 2>/dev/null; echo; echo '== H2 cfg listen/auth =='; grep -E '^(listen|auth|password)' /etc/hysteria/config.yaml 2>/dev/null; echo; echo '== UDP 443 =='; ss -lunp | grep :443 || true`;
console.log('--- CZ 185.87.148.138 ---'); await run('185.87.148.138','hf6Ka8viMl',cmd);
console.log('\n--- RU 82.202.128.147 ---'); await run('82.202.128.147','K!E2QAGrxYFx',cmd);
