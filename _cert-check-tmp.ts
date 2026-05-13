import { Client } from 'ssh2';
const c = new Client();
const cmd = `
ls -la /root/.acme.sh/reality.panelsu.ru_ecc/
openssl x509 -in /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.cer -noout -subject -issuer -dates -ext subjectAltName
echo '--- chain ---'
openssl x509 -in /root/.acme.sh/reality.panelsu.ru_ecc/fullchain.cer -noout -subject -issuer 2>/dev/null
echo '--- hysteria using fullchain? ---'
grep -E 'cert|key' /etc/hysteria/config.yaml
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
