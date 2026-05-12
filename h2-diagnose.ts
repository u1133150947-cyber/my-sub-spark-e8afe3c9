import { Client } from 'ssh2';

const hosts = [
  { name: 'RU', host: '82.202.128.147', domain: 'ru.panelsu.ru', password: 'K!E2QAGrxYFx' },
  { name: 'CZ', host: '185.87.148.138', domain: 'cz.panelsu.ru', password: 'hf6Ka8viMl' },
];

const cmd = `
printf '== host ==\n'; hostname -f || hostname
printf '\n== x-ui/xray status ==\n'; systemctl is-active x-ui || true; systemctl status x-ui --no-pager -n 8 || true
printf '\n== hysteria rows ==\n'
sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,remark,enable,port,protocol,settings,stream_settings FROM inbounds WHERE lower(protocol) LIKE 'hysteria%' OR stream_settings LIKE '%hysteria%' ORDER BY id;" 2>/tmp/sql.err || cat /tmp/sql.err
printf '\n== listeners udp/tcp ==\n'; ss -lunpt | egrep '(:44433|:8443|:4430|:2080)' || true
printf '\n== firewall quick ==\n'; (iptables -S INPUT 2>/dev/null | egrep '44433|DROP|REJECT' || true); (nft list ruleset 2>/dev/null | egrep '44433|drop|reject' | head -80 || true)
printf '\n== generated xray inbound fragments ==\n'
python3 - <<'PY'
import json, sqlite3
con=sqlite3.connect('/etc/x-ui/x-ui.db')
con.row_factory=sqlite3.Row
for r in con.execute("SELECT id,remark,port,protocol,settings,stream_settings FROM inbounds WHERE lower(protocol) LIKE 'hysteria%' OR stream_settings LIKE '%hysteria%' ORDER BY id"):
    print('--- inbound', r['id'], r['remark'], 'port', r['port'], 'protocol', r['protocol'])
    for col in ['settings','stream_settings']:
        try: print(col, json.dumps(json.loads(r[col] or '{}'), ensure_ascii=False, indent=2)[:5000])
        except Exception as e: print(col, 'PARSE_ERR', e, r[col])
PY
printf '\n== x-ui logs hysteria/errors ==\n'; journalctl -u x-ui -n 160 --no-pager | egrep -i 'hysteria|hy2|44433|error|failed|unknown|panic|fatal|quic|tls|certificate' || true
`;

function runOne(h:any){
  return new Promise<void>((resolve)=>{
    const conn = new Client();
    console.log('\n######## '+h.name+' '+h.host+' '+h.domain+' ########');
    conn.on('ready',()=>conn.exec(cmd,(err,stream)=>{
      if(err){ console.error(err); conn.end(); resolve(); return; }
      stream.on('close',()=>{conn.end(); resolve();})
        .on('data',(d:any)=>process.stdout.write(d.toString()))
        .stderr.on('data',(d:any)=>process.stderr.write(d.toString()));
    })).on('error',(e:any)=>{ console.error('SSH error', h.name, e.message); resolve(); })
      .connect({host:h.host,port:22,username:'root',password:h.password, readyTimeout: 15000});
  });
}
for (const h of hosts) await runOne(h);
