import { Client } from 'ssh2';
const c = new Client();
const script = `
echo '== что слушает 8443 =='
ss -lntp | grep -E ':8443|:80 |:443 |:8080|:8000' || echo none
echo '== все enabled services с web именами =='
systemctl list-unit-files --state=enabled | grep -iE 'nginx|caddy|web|http|panelsu|node|pm2|docker' || true
echo '== недавно завершённые =='
journalctl --since '40 min ago' -p err --no-pager | tail -40
echo '== pm2 =='
which pm2 && pm2 list 2>&1 || echo no pm2
echo '== caddy =='
systemctl status caddy --no-pager 2>&1 | head -10 || true
echo '== что было на :80 / :443 (история процессов) =='
# поищем конфиг nginx, что он проксирует
grep -rE 'web\\.panelsu|server_name' /etc/nginx/ 2>/dev/null | head -20
echo '== docker check2 =='
systemctl list-units | grep -i docker || echo no
echo '== /opt /home проекты =='
ls /opt /home /srv /root 2>/dev/null
echo '== ps web/node =='
ps auxf | grep -iE 'node|caddy|http|nginx|python.*serve|gunicorn|uvicorn' | grep -v grep | head -20
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));
})).on('error',e=>console.error(e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD,readyTimeout:20000});