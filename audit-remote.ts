import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'SH' > /tmp/audit_subs.sh
set -e
printf '\n== service ==\n'
systemctl is-active sub-manager || true
printf '\n== recent audit errors ==\n'
sqlite3 data/app.db "SELECT ts, action, panel_slug, subscription_id, error, meta FROM audit_log WHERE error IS NOT NULL OR level='error' ORDER BY ts DESC LIMIT 20;" || true
printf '\n== panels ==\n'
sqlite3 -header -column data/app.db "SELECT slug,name,host,public_host,panel_url,status,status_message FROM panels;"
printf '\n== subscription inbounds counts ==\n'
sqlite3 -header -column data/app.db "SELECT panel,inbound_id,protocol,COUNT(*) cnt FROM subscription_inbounds GROUP BY panel,inbound_id,protocol ORDER BY panel,inbound_id;"
printf '\n== subscriptions sample ==\n'
sqlite3 -header -column data/app.db "SELECT id,slug,name,client_email,substr(client_uuid,1,8)||'...' uuid,expiry_ms,total_bytes FROM subscriptions ORDER BY created_at DESC LIMIT 10;"
printf '\n== recent sub inbounds ==\n'
sqlite3 -header -column data/app.db "SELECT s.slug, si.panel, si.inbound_id, si.protocol, si.client_email, si.host, si.port FROM subscription_inbounds si JOIN subscriptions s ON s.id=si.subscription_id ORDER BY si.created_at DESC LIMIT 20;"
SH
bash /tmp/audit_subs.sh`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
