import { Client } from 'ssh2';
const c = new Client();
const cmd = `python3 -c "import json; d=json.load(open('/usr/local/x-ui/bin/config.json')); print(json.dumps(d.get('outbounds',[]),indent=2,ensure_ascii=False))" | head -80`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
