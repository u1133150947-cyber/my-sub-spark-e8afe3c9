import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r('ERR'+e);return}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host,port:22,username:'root',password:pw,readyTimeout:60000,keepaliveInterval:5000});});}

const cmd = `
set +e
echo '### STOP/DISABLE WARP ###'
systemctl stop warp-svc 2>&1; systemctl disable warp-svc 2>&1
warp-cli --accept-tos disconnect 2>/dev/null
pkill -f warp 2>/dev/null
echo '### REMOVE WARP package ###'
DEBIAN_FRONTEND=noninteractive apt-get -y purge cloudflare-warp 2>&1 | tail -5
echo '### STOP/REMOVE HYSTERIA ###'
systemctl stop hysteria-server 2>&1; systemctl disable hysteria-server 2>&1
systemctl stop hysteria 2>&1; systemctl disable hysteria 2>&1
rm -f /etc/systemd/system/hysteria-server.service /etc/systemd/system/hysteria.service
rm -rf /etc/hysteria /usr/local/bin/hysteria
systemctl daemon-reload
echo '### BBR ON ###'
cat > /etc/sysctl.d/99-bbr.conf <<EOL
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.core.rmem_max=67108864
net.core.wmem_max=67108864
net.ipv4.tcp_rmem=4096 87380 67108864
net.ipv4.tcp_wmem=4096 65536 67108864
net.ipv4.tcp_mtu_probing=1
net.ipv4.tcp_notsent_lowat=131072
EOL
sysctl --system 2>&1 | tail -5
echo '### VERIFY ###'
sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc
systemctl is-active warp-svc 2>&1
systemctl is-active hysteria-server 2>&1
ss -lunp | grep ':443 ' || echo 'no UDP 443 (good, hysteria off)'
echo '### RESTART X-UI ###'
systemctl restart x-ui && sleep 2 && systemctl is-active x-ui
ss -lntp | grep -E ':2080|:8443'
echo '### NIC errors ###'
ip -s link | grep -A2 -E '^[0-9]+:' | head -30
echo '### local ping test ###'
for h in 1.1.1.1 8.8.8.8 youtube.com; do echo "-- \$h --"; ping -c 4 -W 2 \$h | tail -2; done
`;
console.log(await ssh('185.87.148.138','hf6Ka8viMl',cmd));
