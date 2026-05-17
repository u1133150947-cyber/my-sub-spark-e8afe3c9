import {Client} from 'ssh2';
const c=new Client();
// 20 ports spread across well-known/CDN-friendly ranges + random high ports.
// Use SAME Reality config + SAME UUID, only port differs → чистый тест разницы по портам.
const ports=[80,2052,2082,2086,2087,2095,2096,5222,5223,8080,8880,10443,12443,16443,20443,30443,40443,50443,2408,2503];
const UUID='80c4aa5b-607f-4143-9dd1-aa8b12ec4195';
const pbk='XZdhY6nWXUf0z8iNuQgmOefSmCHicInOGMF531-ydRU';
const prv='AIGrrpyrDgq5QNQBu2C010bxVIFVSrRvsbRsjn2__1Q';
const sid='20d4bcd57356d8a8';

const settings = JSON.stringify({
  clients:[{id:UUID,flow:"xtls-rprx-vision",email:`ping-test-${UUID.slice(0,4)}`,enable:true,expiryTime:0,limitIp:0,reset:0,subId:"pingtest",tgId:"",totalGB:0,created_at:Date.now(),updated_at:Date.now()}],
  decryption:"none",fallbacks:[]
});
const stream = JSON.stringify({
  network:"tcp",security:"reality",externalProxy:[],
  realitySettings:{show:false,xver:0,dest:"ya.ru:443",serverNames:["ya.ru"],privateKey:prv,publicKey:pbk,minClient:"",maxClient:"",maxTimediff:0,shortIds:[sid],settings:{publicKey:pbk,fingerprint:"chrome",serverName:"",spiderX:"/"}},
  tcpSettings:{acceptProxyProtocol:false,header:{type:"none"}}
});
const sniff = `{"enabled":true,"destOverride":["http","tls","quic"],"metadataOnly":false,"routeOnly":false}`;

const sqlLines = ports.map(p=>{
  const tag=`ping-test-${p}`;
  const remark=`PING ${p}`;
  return `INSERT OR IGNORE INTO inbounds (user_id,up,down,total,all_time,remark,enable,expiry_time,listen,port,protocol,settings,stream_settings,tag,sniffing) VALUES (1,0,0,0,0,'${remark}',1,0,'',${p},'vless','${settings.replace(/'/g,"''")}','${stream.replace(/'/g,"''")}','${tag}','${sniff}');`;
}).join('\n');

const cmd=`
cat > /tmp/add_ping.sql <<'SQL'
${sqlLines}
SQL
sqlite3 /etc/x-ui/x-ui.db < /tmp/add_ping.sql
echo '--- inserted ---'
sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,port,protocol,enable FROM inbounds WHERE remark LIKE 'PING %' ORDER BY port;"
echo '--- restart x-ui ---'
systemctl restart x-ui
sleep 3
systemctl is-active x-ui
echo '--- listeners ---'
ss -lntp | awk '{print $4}' | grep -oE ':[0-9]+$' | sort -un | head -40
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});

// Also print VLESS URLs for the user
console.log('\n\n=== VLESS keys (paste in any client to test ping/latency) ===');
for(const p of ports){
  const url=`vless://${UUID}@reality.panelsu.ru:${p}?type=tcp&encryption=none&security=reality&sni=ya.ru&sid=${sid}&pbk=${pbk}&fp=chrome&spx=%2F&flow=xtls-rprx-vision#PING-${p}`;
  console.log(url);
}
