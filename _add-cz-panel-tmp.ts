import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
sqlite3 /opt/sub-manager/data/app.db <<'SQL'
INSERT OR REPLACE INTO panels
  (id, slug, name, country, host, public_host, panel_url, username, password, template, readiness,
   ssh_user, ssh_port, ssh_auth_type, ssh_password, ssh_key_passphrase,
   status, status_message, created_at, updated_at)
VALUES
  ('cz-panel-001', 'pcz' || lower(hex(randomblob(4))), 'Чехия', 'CZ',
   'cz.panelsu.ru', 'cz.panelsu.ru',
   'https://cz.panelsu.ru:2053/czpanel_a7f3k9/',
   'cz_admin_x9K', 'CZ_p@nel_2026!xK9',
   'cascade_yandex', 'auto',
   'root', 22, 'password', 'hf6Ka8viMl', '',
   'unknown', '', datetime('now'), datetime('now'));
SELECT slug, name, panel_url, username, country FROM panels;
SQL
systemctl restart sub-manager
sleep 2
systemctl is-active sub-manager
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
