import { Client } from 'ssh2';
const c = new Client();
const cmd = `
sqlite3 /opt/sub-manager/data/app.db <<SQL
.headers on
.mode column
SELECT '--- ALL subscription_inbounds ---';
SELECT subscription_id, panel, inbound_id, remark, protocol, port, host, client_email FROM subscription_inbounds ORDER BY subscription_id, panel, inbound_id;
SELECT '--- standalone_servers ---';
SELECT * FROM standalone_servers;
SELECT '--- vern sub ---';
SELECT id, slug, client_uuid, client_email FROM subscriptions WHERE slug='4p3y8viw1txl';
SQL
echo '--- CZ inbound full stream_settings ---'
sqlite3 /etc/x-ui/x-ui.db "SELECT remark, port, stream_settings FROM inbounds WHERE id=28;" 2>/dev/null
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@185.87.148.138 "sqlite3 /etc/x-ui/x-ui.db \"SELECT remark||'|'||port||'|'||stream_settings FROM inbounds WHERE id=28;\""
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));
})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
