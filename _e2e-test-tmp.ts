import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string,timeout=30000){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host,port:22,username:'root',password:pw,readyTimeout:timeout});});}

// Fetch sub content for all users via web endpoint
const slugs = ['0cps6a3s1kys','a4u011bzvlb9','uia3c088ozg3','nspm78u5yko1','z7didjgr05po','fwvoww2fyz5s','ejzyw1olmdgn','sjqcn9zob54v','4p3y8viw1txl'];
const names = ['Andrey','Dmitry','Olya','Paul','Test','Yuri','alina','anton','vern'];

console.log('== Subscription content per user ==');
for (let i=0;i<slugs.length;i++){
  const r = await fetch(`https://web.panelsu.ru/sub/${slugs[i]}`);
  const t = await r.text();
  const lines = t.split('\n').filter(l=>l.trim()).map(l=>{
    if (l.startsWith('vless://')) return 'vless ✓';
    if (l.startsWith('hysteria')||l.startsWith('hy2://')) return 'HYSTERIA ✗';
    if (l.startsWith('vmess')||l.startsWith('ss://')||l.startsWith('trojan')) return l.split('://')[0];
    return l.substring(0,40);
  });
  console.log(`  ${names[i].padEnd(8)} (${slugs[i]}): http=${r.status} links=[${lines.join(', ')}]`);
}

// Pick vern, do live connectivity test through RU 8443 cascade
console.log('\n== Live cascade test for vern (RU 8443 -> CZ 2080 -> internet) ==');
const vernSub = await fetch('https://web.panelsu.ru/sub/4p3y8viw1txl');
const subText = await vernSub.text();
const decoded = Buffer.from(subText, 'base64').toString('utf-8').split('\n').filter(l=>l.startsWith('vless://'));
console.log('VLESS links found:', decoded.length);
const ruLink = decoded.find(l=>l.includes(':8443'));
console.log('RU cascade link:', ruLink ? ruLink.substring(0,150)+'...' : 'NOT FOUND');

if (ruLink) {
  // Run a real connectivity test from CZ (clean third party) using xray client
  const u = new URL(ruLink);
  const uuid = u.username;
  const host = u.hostname; const port = u.port;
  const sni = u.searchParams.get('sni')||'';
  const pbk = u.searchParams.get('pbk')||'';
  const sid = u.searchParams.get('sid')||'';
  const fp = u.searchParams.get('fp')||'chrome';
  const flow = u.searchParams.get('flow')||'';
  console.log(`uuid=${uuid} host=${host}:${port} sni=${sni} pbk=${pbk.substring(0,20)}... sid=${sid}`);

  const cfg = JSON.stringify({
    log:{loglevel:'warning'},
    inbounds:[{port:11180,protocol:'socks',settings:{auth:'noauth',udp:true},listen:'127.0.0.1'}],
    outbounds:[{protocol:'vless',settings:{vnext:[{address:host,port:+port,users:[{id:uuid,encryption:'none',flow}]}]},streamSettings:{network:'tcp',security:'reality',realitySettings:{serverName:sni,publicKey:pbk,shortId:sid,fingerprint:fp}}}]
  });
  const cmd = `set +e
echo '${Buffer.from(cfg).toString('base64')}' | base64 -d > /tmp/v.json
which xray || ls /usr/local/x-ui/bin/xray-linux-amd64
XRAY=/usr/local/x-ui/bin/xray-linux-amd64
$XRAY run -c /tmp/v.json >/tmp/x.log 2>&1 &
P=$!
for i in 1 2 3 4 5 6 7 8; do ss -lntp 2>/dev/null | grep -q ':11180' && break; sleep 1; done
echo '-- ipify (should show CZ exit) --'
curl -sS --max-time 15 --socks5-hostname 127.0.0.1:11180 https://api.ipify.org; echo
echo '-- generate_204 --'
curl -sS -o /dev/null -w 'http=%{http_code} time=%{time_total}\n' --max-time 15 --socks5-hostname 127.0.0.1:11180 https://www.gstatic.com/generate_204
echo '-- xray log tail --'
tail -20 /tmp/x.log
kill $P 2>/dev/null
`;
  // Run from CZ host (clean external client)
  const r = await ssh('185.87.148.138','hf6Ka8viMl',cmd,20000);
  console.log(r);
}
