import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
systemctl stop sub-manager
sleep 1
sqlite3 /opt/sub-manager/data/app.db <<SQL
.headers on
-- 1. Remove RU (pee9e3676f7:1) from all subscriptions
DELETE FROM subscription_inbounds WHERE panel='pee9e3676f7' AND inbound_id=1;
-- 2. Update CZ override to include Czech flag
UPDATE inbound_overrides SET display_remark='🇨🇿 Европа | Стандартный', updated_at=datetime('now') WHERE panel='pd4e485d3c9' AND inbound_id=28;
SELECT '--- overrides ---';
SELECT panel, inbound_id, display_remark FROM inbound_overrides;
SELECT '--- subscription_inbounds ---';
SELECT subscription_id, panel, inbound_id, remark FROM subscription_inbounds ORDER BY subscription_id, panel, inbound_id;
SQL
systemctl start sub-manager
sleep 2
systemctl is-active sub-manager
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
