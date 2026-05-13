import {Client} from 'ssh2';
function ssh(c:string){return new Promise<string>(r=>{const x=new Client();let o='';x.on('ready',()=>x.exec(c,(e,s)=>{if(e){r(String(e));return}s.on('close',()=>{x.end();r(o)}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString())})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'})})}
console.log(await ssh("sqlite3 /usr/local/h-ui/data/h_ui.db \"SELECT username,pass,con_pass FROM account WHERE role='admin';\""))
