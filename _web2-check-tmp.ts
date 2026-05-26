import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:8080/)
  echo "loop$i :8080 -> $code  | ss: $(ss -tln 'sport = :8080' 2>/dev/null | tail -1)"
  if [ "$code" != "000" ]; then break; fi
  sleep 4
done
echo '--- last 60 lines journal sub-manager ---'
journalctl -u sub-manager -n 60 --no-pager | tail -60
echo '--- external https ---'
curl -skI --max-time 8 https://web2.panelsu.ru/ | head -8
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write('E:'+d));}))
.on('error',e=>console.error(e.message))
.connect({host:'150.241.70.207',username:'root',password:'MzXsgTR1v4026oAIe',readyTimeout:20000});