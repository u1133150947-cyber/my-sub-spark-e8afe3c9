import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
sqlite3 /etc/x-ui/x-ui.db "DELETE FROM inbounds WHERE remark LIKE 'PING %';"
echo '=== remaining inbounds ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,port,protocol,enable FROM inbounds ORDER BY port;"
echo '--- restart x-ui ---'
systemctl restart x-ui
sleep 3
systemctl is-active x-ui
echo '--- listeners after cleanup ---'
ss -lntp | grep xray | awk '{print $4}'
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
