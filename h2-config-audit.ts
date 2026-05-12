import { Client } from 'ssh2';
const hosts = [
  { name: 'RU', host: '82.202.128.147', password: 'K!E2QAGrxYFx' },
  { name: 'CZ', host: '185.87.148.138', password: 'hf6Ka8viMl' },
];
const cmd = `python3 - <<'PY'
import json, pathlib, socket
print('HOST', socket.gethostname())
paths=['/usr/local/x-ui/bin/config.json','/usr/local/x-ui/bin/config.json.tmp','/etc/x-ui/x-ui.db']
try:
  cfg=json.loads(pathlib.Path('/usr/local/x-ui/bin/config.json').read_text())
  print('CONFIG_INBOUNDS')
  for ib in cfg.get('inbounds',[]):
    if ib.get('protocol')=='hysteria' or ib.get('port')==44433 or 'hysteria' in json.dumps(ib):
      print(json.dumps(ib, ensure_ascii=False, indent=2))
except Exception as e: print('CONFIG_ERR',e)
PY
printf '\nSS\n'; ss -lunpt | grep 44433 || true
printf '\nCERTS\n'; for d in ru.panelsu.ru cz.panelsu.ru; do ls -l /var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/$d/ 2>/dev/null || true; done
printf '\nCZ/RU DB SHORT\n'; sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,enable,port,protocol,stream_settings FROM inbounds WHERE port=44433 OR protocol='hysteria';"`;
async function runOne(h:any){return new Promise<void>(resolve=>{const c=new Client(); console.log('\n###',h.name,'###'); c.on('ready',()=>c.exec(cmd,(err,s)=>{if(err){console.error(err); c.end(); resolve(); return;} s.on('close',()=>{c.end(); resolve();}).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))})).on('error',(e:any)=>{console.error(e.message); resolve();}).connect({host:h.host,port:22,username:'root',password:h.password})})}
for (const h of hosts) await runOne(h);
