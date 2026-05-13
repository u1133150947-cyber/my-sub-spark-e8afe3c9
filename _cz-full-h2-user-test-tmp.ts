import { Client } from 'ssh2';

function ssh(host: string, password: string, cmd: string) {
  return new Promise<string>((resolve) => {
    const c = new Client();
    let out = '';
    c.on('ready', () => c.exec(cmd, (err, s) => {
      if (err) { out += String(err); c.end(); resolve(out); return; }
      s.on('close', () => { c.end(); resolve(out); })
       .on('data', d => { out += d.toString(); })
       .stderr.on('data', d => { out += d.toString(); });
    })).on('error', e => resolve('SSH error: ' + e.message))
      .connect({ host, port: 22, username: 'root', password, readyTimeout: 15000 });
  });
}

const getUuidCmd = `
set +e
DB=/opt/sub-manager/data/app.db
if [ ! -f "$DB" ]; then DB=/opt/sub-manager/app.db; fi
sqlite3 "$DB" -line "SELECT id,slug,name,client_email,client_uuid,expiry_ms FROM subscriptions WHERE lower(name) LIKE '%vern%' OR lower(client_email) LIKE '%vern%' OR lower(slug) LIKE '%vern%' LIMIT 5;"
`;
const ruOut = await ssh('82.202.128.147', 'K!E2QAGrxYFx', getUuidCmd);
console.log('== RU subscription lookup ==\n' + ruOut);
const uuid = (ruOut.match(/client_uuid = ([0-9a-f-]{20,})/i) || [])[1];
if (!uuid) throw new Error('UUID not found for vern');

const testCmd = `
set +e
UUID='${uuid}'
printf '== auth check from RU to web endpoint ==\n'
curl -k -sS --max-time 8 -X POST https://web.panelsu.ru/api/hy2/auth -H 'content-type: application/json' -d '{"auth":"'"$UUID"'","addr":"127.0.0.1:12345"}'; echo
printf '\n== dns reality.panelsu.ru ==\n'; getent ahostsv4 reality.panelsu.ru | head || true
printf '\n== hysteria binary ==\n'; command -v hysteria || true; hysteria version 2>/dev/null | head -5 || true
cat > /tmp/hcli-vern.yaml <<YAML
server: reality.panelsu.ru:443
auth: $UUID
tls:
  sni: reality.panelsu.ru
socks5:
  listen: 127.0.0.1:11082
YAML
printf '\n== start h2 client RU->CZ and curl through it ==\n'
timeout 14 hysteria client -c /tmp/hcli-vern.yaml >/tmp/hcli-vern.log 2>&1 &
P=$!
for i in 1 2 3 4 5; do ss -lntp | grep -q ':11082' && break; sleep 1; done
printf '-- curl ipify --\n'
curl -4 -sS --max-time 10 --socks5 127.0.0.1:11082 https://api.ipify.org; echo
printf '-- curl google 204 status --\n'
curl -4 -sS -o /dev/null -w 'http=%{http_code} ip=%{remote_ip}\n' --max-time 10 --socks5 127.0.0.1:11082 https://www.gstatic.com/generate_204
printf '\n== h2 client log ==\n'; cat /tmp/hcli-vern.log
kill $P 2>/dev/null || true
`;
const ruTest = await ssh('82.202.128.147', 'K!E2QAGrxYFx', testCmd);
console.log('== RU full H2 test ==\n' + ruTest);
