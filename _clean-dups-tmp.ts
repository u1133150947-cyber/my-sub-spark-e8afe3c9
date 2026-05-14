import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
systemctl stop sub-manager
sleep 1
sqlite3 /opt/sub-manager/data/app.db <<SQL
.headers on
-- 1. Remove fake "Чехия" override from RU inbound 1 — real CZ now exists
DELETE FROM inbound_overrides WHERE panel='pee9e3676f7' AND inbound_id=1;
-- 2. Remove orphan standalone overrides (standalone_servers already empty)
DELETE FROM inbound_overrides WHERE panel='standalone';
-- 3. Refresh stale cached remarks in subscription_inbounds for RU:1 (some had "cz Чехия ↺ RU")
UPDATE subscription_inbounds SET remark='RU', host='ru.panelsu.ru' WHERE panel='pee9e3676f7' AND inbound_id=1;
UPDATE subscription_inbounds SET remark='RU_YouTube', host='ru.panelsu.ru' WHERE panel='pee9e3676f7' AND inbound_id=2;
SELECT '--- overrides after ---';
SELECT * FROM inbound_overrides;
SELECT '--- subscription_inbounds after ---';
SELECT subscription_id, panel, inbound_id, remark, host FROM subscription_inbounds ORDER BY subscription_id, panel, inbound_id;
SQL
systemctl start sub-manager
sleep 2
systemctl is-active sub-manager
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
