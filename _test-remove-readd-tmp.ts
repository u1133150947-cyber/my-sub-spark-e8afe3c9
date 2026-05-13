import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});});}

const script = `
set +e
DB=/opt/sub-manager/data/app.db

echo "═══ 1. Текущее состояние БД ═══"
sqlite3 -header -column "$DB" "SELECT s.name, s.client_uuid, COUNT(si.id) as inbounds FROM subscriptions s LEFT JOIN subscription_inbounds si ON si.subscription_id=s.id GROUP BY s.id ORDER BY s.name;"

echo ""
echo "═══ 2. Все client_email в subscription_inbounds ═══"
sqlite3 "$DB" "SELECT panel, inbound_id, client_email FROM subscription_inbounds ORDER BY panel,inbound_id;" | head -30

echo ""
echo "═══ 3. Запрашиваем актуальный список клиентов с панели РФ через API ═══"
# Логин в 3x-ui RU
COOKIE=\$(curl -sk -c - -X POST "https://msk.panelsu.ru/p9k2x4/login" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "username=admin&password=admin" | grep -i "3x-ui" | awk '{print \$6"="\$7}')
echo "Cookie: \${COOKIE:0:40}..."

# Список инбаундов с клиентами
curl -sk -X POST "https://msk.panelsu.ru/p9k2x4/panel/api/inbounds/list" \\
  -H "Cookie: \$COOKIE" 2>/dev/null | \\
  python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data.get('success'):
    print('API err:', data.get('msg'))
    sys.exit(0)
for ib in data['obj']:
    try: settings = json.loads(ib.get('settings','{}'))
    except: settings = {}
    clients = settings.get('clients', [])
    print(f\"inbound #{ib['id']} '{ib.get('remark','?')}' port={ib.get('port')} → {len(clients)} clients\")
    for c in clients:
        print(f\"   • {c.get('email','?'):40s} uuid={c.get('id','?')[:8]}...\")
"
`;
console.log(await ssh(script));
