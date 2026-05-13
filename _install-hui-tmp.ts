import { Client } from 'ssh2';
const c = new Client();
const cmd = `set +e
echo '== stop old hysteria =='
systemctl stop hysteria-server 2>&1 | tail -3
systemctl disable hysteria-server 2>&1 | tail -3
cp /etc/hysteria/config.yaml /root/hysteria-config.yaml.bak.$(date +%s) 2>/dev/null
echo '== ports before =='
ss -lntup | egrep ':(443|8081|36963)' | head
echo '== install h-ui =='
export HUI_PORT=8081
export HUI_TIME_ZONE=Europe/Prague
bash <(curl -fsSL https://raw.githubusercontent.com/jonssonyan/h-ui/main/install.sh) 2>&1 | tail -40
echo '== status =='
systemctl status h-ui --no-pager 2>&1 | head -15
ss -lntup | egrep ':(443|8081|36963)' | head
echo '== h-ui info =='
h-ui status 2>&1 | head -20
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){console.error(e);c.end();return;}s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).on('error',e=>console.error('SSH:',e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:20000});
