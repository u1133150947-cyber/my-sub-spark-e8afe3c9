import { Client } from 'ssh2';
const c = new Client();
const script = `
echo '== os =='
cat /etc/os-release | grep -E '^(NAME|VERSION)='
uname -a
echo '== mem/cpu =='
free -h | head -2
nproc
echo '== disk =='
df -h / | head -2
echo '== listen ports =='
ss -lntp 2>/dev/null | head -30
ss -lunp 2>/dev/null | head -15
echo '== services =='
systemctl list-units --type=service --state=running --no-pager 2>/dev/null | grep -iE 'remna|xray|x-ui|hysteria|nginx|caddy|node|docker|panel|sing|marz' | head -30
echo '== docker =='
which docker && docker ps -a 2>&1 | head -30 || echo 'no docker'
echo '== known panels paths =='
ls -la /opt /root 2>/dev/null
ls /usr/local/bin/ 2>/dev/null | grep -iE 'xui|hysteria|sing|xray|remna|marz' || echo none
echo '== /etc/remnawave =='
ls /etc/remnawave 2>/dev/null || echo no
echo '== firewall =='
ufw status 2>/dev/null | head -5
echo '== fail2ban / x-ui binary =='
systemctl status x-ui --no-pager 2>&1 | head -5 || true
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write('E: '+d.toString()));
})).on('error',e=>console.error('ERR',e.message))
.connect({host:'150.241.70.207',port:22,username:'root',password:'MzXsgTR1v4026oAIe',readyTimeout:30000});