import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== ping RU from CZ ==='
ping -c 3 -W 2 82.202.128.147
echo '=== SSH connect test ==='
sshpass -p 'K!E2QAGrxYFx' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@82.202.128.147 'echo OK; uptime; systemctl is-active x-ui; ss -lntp | grep -E ":(2053|443|8443|4430) "; journalctl -u x-ui -n 20 --no-pager' 2>&1
echo '=== exit ==='
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()))})).on('error',e=>console.error('SSH ERR:',e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:15000});
