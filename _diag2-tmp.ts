import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host,port:22,username:'root',password:pw,readyTimeout:15000});});}

const ru = await ssh('82.202.128.147','K!E2QAGrxYFx',`
set +e
echo '== running xray inbounds tags =='
ss -lntup | grep xray
echo '== xray running config inbound tags & ports =='
PID=$(pgrep -f 'xray.*-config' | head -1)
echo PID=$PID
CONF=$(ls -la /proc/$PID/cwd 2>/dev/null; ps -o args= -p $PID 2>/dev/null)
echo "$CONF"
# 3x-ui exposes config via API; just dump generated bin/config.json
ls /usr/local/x-ui/bin/ 2>/dev/null
cat /usr/local/x-ui/bin/config.json 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for ib in d.get('inbounds',[]):
  print('INBOUND tag=%s port=%s proto=%s' % (ib.get('tag'),ib.get('port'),ib.get('protocol')))
print('---')
for r in d.get('routing',{}).get('rules',[]):
  print('RULE',r)
print('---')
for o in d.get('outbounds',[]):
  print('OUTBOUND tag=%s proto=%s' % (o.get('tag'),o.get('protocol')))
"
echo '== test 8443 -> internet via cascade (curl through RU vless not possible from server itself) =='
echo '== check CZ side accept from RU =='
`);
console.log('==RU==\n'+ru);

const cz = await ssh('185.87.148.138','hf6Ka8viMl',`
cat /usr/local/x-ui/bin/config.json 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for ib in d.get('inbounds',[]):
  print('INBOUND tag=%s port=%s proto=%s clients=%d' % (ib.get('tag'),ib.get('port'),ib.get('protocol'),len(ib.get('settings',{}).get('clients',[]))))
"
echo '== recent xray traffic on CZ 2080 =='
journalctl -u x-ui -n 30 --no-pager | tail -10
`);
console.log('==CZ==\n'+cz);
