import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});});}
console.log(await ssh(`
DB=/opt/sub-manager/data/app.db
echo '== CZ row stream_settings =='
sqlite3 $DB "SELECT stream_settings FROM subscription_inbounds WHERE id='0645565c46a7efa84b6bf6992c01b56d';"
echo
echo '== RU hysteria stream_settings (for comparison) =='
sqlite3 $DB "SELECT stream_settings FROM subscription_inbounds WHERE id='73a02528-9f19-4f74-88c2-60d0ec2ee6f7';"
echo
echo '== generated subscription =='
curl -sS https://web.panelsu.ru/sub/4p3y8viw1txl | base64 -d 2>/dev/null | grep -E 'hysteria|hy2'
`));
