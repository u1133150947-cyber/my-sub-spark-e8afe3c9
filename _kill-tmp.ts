import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`pkill -9 -f "_add-cz.ts"; sleep 1; curl -sS -o /dev/null -w "cz_panel=%{http_code} t=%{time_total}\n" --max-time 10 https://cz.panelsu.ru:35978/`,
(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
