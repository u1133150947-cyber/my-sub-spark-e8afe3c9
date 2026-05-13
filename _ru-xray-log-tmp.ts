import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== xray journal last 30 ==='
journalctl -u x-ui -n 40 --no-pager | tail -40
echo '=== xray access log ==='
ls /var/log/x-ui/ 2>/dev/null
tail -50 /usr/local/x-ui/access.log 2>/dev/null
tail -50 /var/log/x-ui/access.log 2>/dev/null
echo '=== x-ui error ==='
tail -50 /usr/local/x-ui/error.log 2>/dev/null
tail -50 /var/log/x-ui/error.log 2>/dev/null
echo '=== test outbound manually ==='
# Find xray bin and test
ls /usr/local/x-ui/bin/
# Manually open TCP from RU to CZ:2080
nc -zv 185.87.148.138 2080 2>&1 | head
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
