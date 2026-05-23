import { Client } from 'ssh2';
const c = new Client();
const cmd = `
CFG=/usr/local/x-ui/bin/config.json
jq '.inbounds[] | select(.tag=="inbound-8080") | .settings.clients' \$CFG
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:8000});
