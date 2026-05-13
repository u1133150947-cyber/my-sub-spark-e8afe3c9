import { Client } from 'ssh2';
function run(cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});});}
const cmd = `
mkdir -p /etc/systemd/system/hysteria-server.service.d
printf '[Service]\\nUser=root\\nGroup=root\\n' > /etc/systemd/system/hysteria-server.service.d/override.conf
/usr/bin/systemctl daemon-reload
/usr/bin/systemctl restart hysteria-server
sleep 2
/usr/bin/systemctl is-active hysteria-server
echo --- logs ---
/usr/bin/journalctl -u hysteria-server -n 12 --no-pager
echo --- port ---
/usr/bin/ss -lunp | grep :443
`;
console.log(await run(cmd));
