import { Client } from 'ssh2';
const sh = `set +e
echo "--- GET / ---"
curl -skv -A 'Mozilla/5.0' 'https://de.panelsu.ru:9293/depanel_b3f9a2c1/' 2>&1 | tail -20
echo "--- POST login ---"
curl -skv -A 'Mozilla/5.0' -X POST -H 'Content-Type: application/json' -d '{"username":"de_admin_q7K","password":"Mz8\\$Vp2Wq9Ld!4Bn7Hx"}' 'https://de.panelsu.ru:9293/depanel_b3f9a2c1/login' 2>&1 | tail -30
`;
const c = new Client();
c.on('ready',()=>c.exec(sh,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD!,readyTimeout:15000});
