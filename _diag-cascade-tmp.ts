import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host,port:22,username:'root',password:pw,readyTimeout:15000});});}

// 1. List all subs
const list = await ssh('82.202.128.147','K!E2QAGrxYFx',`sqlite3 /opt/sub-manager/data/app.db "SELECT slug,name,client_uuid FROM subscriptions ORDER BY name;"`);
console.log('== subscriptions ==\n'+list);

// 2. RU x-ui inbound for vless + outbound to CZ
const ruInb = await ssh('82.202.128.147','K!E2QAGrxYFx',`
set +e
echo '== RU x-ui vless inbound =='
sqlite3 /etc/x-ui/x-ui.db -line "SELECT id,remark,port,protocol,enable FROM inbounds WHERE protocol='vless';"
echo '== RU xray template (outbounds) =='
sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='xrayTemplateConfig';" | python3 -c "import sys,json;d=json.load(sys.stdin);[print('outbound:',o.get('tag'),o.get('protocol'),o.get('settings',{}).get('vnext',[{}])[0].get('address','') if o.get('protocol')=='vless' else '') for o in d.get('outbounds',[])]"
echo '== RU xray routing rules =='
sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='xrayTemplateConfig';" | python3 -c "import sys,json;d=json.load(sys.stdin);[print('rule:',r) for r in d.get('routing',{}).get('rules',[])]"
echo '== xray status =='
systemctl is-active x-ui
echo '== recent xray errors =='
journalctl -u x-ui -n 30 --no-pager | egrep -i 'error|fail|panic' | tail -10
`);
console.log(ruInb);

// 3. CZ vless inbound (cascade target)
const czInb = await ssh('185.87.148.138','hf6Ka8viMl',`
set +e
echo '== CZ x-ui vless inbound =='
sqlite3 /etc/x-ui/x-ui.db -line "SELECT id,remark,port,protocol,enable FROM inbounds WHERE protocol='vless';"
echo '== CZ x-ui status =='
systemctl is-active x-ui
echo '== CZ hysteria status (still running but unused now) =='
systemctl is-active hysteria-server
`);
console.log(czInb);
