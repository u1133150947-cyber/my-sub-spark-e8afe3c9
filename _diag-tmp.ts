import { Client } from 'ssh2';
function run(host:string,pw:string,cmd:string){return new Promise<void>(res=>{const c=new Client();c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>{c.end();res();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>{console.error(host,e.message);res();}).connect({host,port:22,username:'root',password:pw,readyTimeout:15000});});}
const cmd=`
echo '=== HOSTNAME / PUBLIC IP ==='; hostname; curl -s --max-time 5 ifconfig.me; echo
echo '=== WARP STATUS ==='; warp-cli --accept-tos status 2>/dev/null || echo no-warp-cli
warp-cli --accept-tos settings 2>/dev/null | head -20
echo '=== SOCKS 40000 ==='; ss -lntp | grep 40000 || echo no-socks
echo '=== HYSTERIA CONFIG ==='; grep -A2 -E 'outbounds|socks|warp|acl' /etc/hysteria/config.yaml 2>/dev/null | head -40
echo '=== HYSTERIA STATUS ==='; systemctl is-active hysteria-server; journalctl -u hysteria-server -n 20 --no-pager | tail -20
echo '=== XRAY CONFIG OUTBOUNDS ==='; cat /usr/local/x-ui/bin/config.json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('outbounds',[]),indent=2)[:2000]); print('---routing---'); print(json.dumps(d.get('routing',{}),indent=2)[:1500])" 2>/dev/null || echo no-xray-config
echo '=== TEST CURL DIRECT ==='; curl -s --max-time 5 ifconfig.me; echo
echo '=== TEST CURL via WARP socks ==='; curl -s --max-time 8 --socks5 127.0.0.1:40000 ifconfig.me; echo
`;
console.log('\n############ CZ 185.87.148.138 ############');
await run('185.87.148.138','hf6Ka8viMl',cmd);
console.log('\n############ RU 82.202.128.147 ############');
await run('82.202.128.147','K!E2QAGrxYFx',cmd);
