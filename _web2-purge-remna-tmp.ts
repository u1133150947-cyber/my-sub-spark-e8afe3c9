import { Client } from 'ssh2';
const c = new Client();
const script = `set +e
echo '== stop docker stacks =='
cd /opt/remnawave 2>/dev/null && ls -la
# попробуем найти и снести compose
for d in /opt/remnawave /opt/remnawave-*; do
  [ -d "$d" ] || continue
  cd "$d"
  ls -la
  if [ -f docker-compose.yml ] || [ -f compose.yml ]; then
    docker compose down -v --remove-orphans 2>&1 | tail -5
  fi
done

echo '== force stop any remna containers =='
docker ps -a --format '{{.ID}} {{.Names}} {{.Image}}' | grep -iE 'remna|valkey|postgres:18' || echo none
docker ps -aq | xargs -r docker stop 2>&1 | tail -5
docker ps -aq | xargs -r docker rm -f 2>&1 | tail -5
docker volume ls -q | xargs -r docker volume rm 2>&1 | tail -10
docker network ls --format '{{.Name}}' | grep -iE 'remna' | xargs -r docker network rm 2>&1 | tail -5
docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -iE 'remna|valkey|nginx:1.28|postgres:18' | xargs -r docker rmi -f 2>&1 | tail -10

echo '== kill 2222 process =='
ss -lntp | grep 2222 || echo no 2222
fuser -k 2222/tcp 2>/dev/null || true
# remnawave_reverse - найти и убрать
ls -la /root/remnawave_reverse 2>/dev/null && {
  systemctl stop remnawave_reverse 2>/dev/null
  systemctl disable remnawave_reverse 2>/dev/null
  rm -f /etc/systemd/system/remnawave*.service
  rm -f /etc/systemd/system/multi-user.target.wants/remnawave*.service
  systemctl daemon-reload
}
pkill -9 -f remnawave 2>/dev/null
pkill -9 -f rw-core 2>/dev/null
sleep 1

echo '== remove dirs =='
rm -rf /opt/remnawave /opt/remnawave-* /root/remnawave_reverse

echo '== final check =='
ss -lntp | grep -vE '127.0.0.5[34]:53|0.0.0.0:22|\\[::\\]:22'
docker ps -a
echo '== docker system =='
docker system df 2>&1 | head -10
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write('E: '+d.toString()));
})).on('error',e=>console.error('ERR',e.message))
.connect({host:'150.241.70.207',port:22,username:'root',password:'MzXsgTR1v4026oAIe',readyTimeout:30000});