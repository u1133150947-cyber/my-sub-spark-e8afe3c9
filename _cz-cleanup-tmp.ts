import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string,t=120000){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r('ERR:'+e);return}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host,port:22,username:'root',password:pw,readyTimeout:60000,keepaliveInterval:5000});});}

const cmd = `
set +e
echo '### 1. xray outbounds BEFORE ###'
cat /usr/local/x-ui/bin/config.json 2>/dev/null | python3 -c "import sys,json;c=json.load(sys.stdin);print(json.dumps(c.get('outbounds'),indent=2));print('---routing---');print(json.dumps(c.get('routing'),indent=2))" 2>/dev/null | head -100

echo '### 2. inbounds in DB ###'
sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,port,protocol,enable FROM inbounds;"

echo '### 3. xui_outbounds setting ###'
sqlite3 /etc/x-ui/x-ui.db "SELECT key,substr(value,1,500) FROM settings WHERE key LIKE '%outbound%' OR key='xrayTemplateConfig';" | head -c 3000
`;
console.log(await ssh('185.87.148.138','hf6Ka8viMl',cmd));
