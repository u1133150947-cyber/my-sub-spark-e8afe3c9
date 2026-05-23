import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== requests to origin via CDN domain in last 5 min ==='
grep 'kclxvgxzs7' /var/log/nginx/access.log | tail -20
echo
echo '=== ALL recent requests ==='
tail -30 /var/log/nginx/access.log
echo
echo '=== test curl as CDN with proper Host ==='
curl -sk -m 5 -H 'Host: kclxvgxzs7.cdn.twcstorage.ru' https://185.87.148.138/ -w '\nstatus: %{http_code}\n'
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
