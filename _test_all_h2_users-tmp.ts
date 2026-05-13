import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== H2 inbound id/port/protocol ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,port,protocol,enable FROM inbounds WHERE protocol='hysteria2';"
echo
echo '=== H2 clients (auth list) ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT settings FROM inbounds WHERE protocol='hysteria2';" > /tmp/h2set.json
python3 -c "import json;j=json.load(open('/tmp/h2set.json'));u=j.get('users',[]);print('total:',len(u));[print(' -',x.get('email'),x.get('password')[:8]+'...') for x in u]"
echo
echo '=== /etc/hysteria/config.yaml auth block ==='
grep -A4 '^auth:' /etc/hysteria/config.yaml
echo
echo '=== panel hy2 auth endpoint ==='
grep -i 'hy2' /etc/hysteria/config.yaml | head
`;
c.on('ready',()=>c.exec(cmd,(_e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
