import { Client } from 'ssh2';
function run(host:string,pw:string,cmd:string){return new Promise<void>(res=>{const c=new Client();c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>{c.end();res();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error(host,e.message);res();}).connect({host,port:22,username:'root',password:pw,readyTimeout:15000});});}
const cmd = `sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,remark,port,protocol,listen FROM inbounds WHERE protocol LIKE 'hysteria%' OR protocol='hy2';"`;
console.log('--- CZ ---'); await run('185.87.148.138','hf6Ka8viMl',cmd);
console.log('\n--- RU ---'); await run('82.202.128.147','K!E2QAGrxYFx',cmd);
