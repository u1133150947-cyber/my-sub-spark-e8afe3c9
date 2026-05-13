import { Client } from 'ssh2';
const c = new Client();
const cmd = `
set -e
cp /etc/hysteria/config.yaml /etc/hysteria/config.yaml.bak.$(date +%s)
python3 - <<'PY'
import yaml
p='/etc/hysteria/config.yaml'
d=yaml.safe_load(open(p))
ob=d.get('outbounds') or []
# Ensure warp exists; rename to default-warp and put first; add acl
warp=None
for o in ob:
  if o.get('name')=='warp': warp=o
if not warp:
  warp={'name':'warp','type':'socks5','socks5':{'addr':'127.0.0.1:40000'}}
  ob.append(warp)
d['outbounds']=[warp] + [o for o in ob if o.get('name')!='warp']
d['acl']={'inline':['warp(all)']}
open(p,'w').write(yaml.safe_dump(d, sort_keys=False))
print(open(p).read())
PY
systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server
journalctl -u hysteria-server -n 15 --no-pager | tail -15
echo '=== quick proxy test through hysteria local? skipped ==='
echo '=== direct curl ==='; curl -s --max-time 5 -4 ifconfig.me; echo
echo '=== via warp socks ==='; curl -s --max-time 8 --socks5 127.0.0.1:40000 -4 ifconfig.me; echo
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
