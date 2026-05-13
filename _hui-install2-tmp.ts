import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
nohup bash -c 'curl -fsSL https://raw.githubusercontent.com/jonssonyan/h-ui/main/install.sh -o /tmp/hui.sh && bash /tmp/hui.sh' > /tmp/hui-install.log 2>&1 < /dev/null &
echo started pid=$!
sleep 3
echo '--- log so far ---'
tail -20 /tmp/hui-install.log
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
