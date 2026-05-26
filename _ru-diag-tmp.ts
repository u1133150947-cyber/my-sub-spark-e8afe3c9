import { Client } from 'ssh2';
const c = new Client();
const script = `
echo '== ss 80/443 tcp =='
ss -lntp | grep -E ':80 |:443 ' || echo 'NONE'
echo '== nginx =='
systemctl status nginx --no-pager 2>&1 | head -15 || true
echo '== apache =='
systemctl status apache2 --no-pager 2>&1 | head -8 || true
echo '== docker =='
which docker && docker ps 2>&1 | head -20 || echo 'no docker'
echo '== try start nginx =='
systemctl start nginx 2>&1 | head -5
systemctl is-active nginx
echo '== ss after =='
ss -lntp | grep -E ':80 |:443 ' || echo 'NONE'
echo '== nginx error tail =='
tail -30 /var/log/nginx/error.log 2>&1 | tail -30 || true
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));
})).on('error',e=>console.error(e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD,readyTimeout:20000});