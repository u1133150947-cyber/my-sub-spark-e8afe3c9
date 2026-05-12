import { Client } from 'ssh2';

const conn = new Client();
const HOST = 'cz.panelsu.ru';
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

const commands = [
  `cat << 'PY' > /tmp/fix_inbound.py
import sqlite3
db = '/etc/x-ui/x-ui.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()
# Find inbounds using port 443
cursor.execute("SELECT id, remark, port FROM inbounds WHERE port = 443;")
rows = cursor.fetchall()
if rows:
    cursor.execute("UPDATE inbounds SET port = 8443 WHERE port = 443;")
    conn.commit()
    print(f"Updated {len(rows)} inbound(s) from port 443 to 8443.")
else:
    print("No inbounds found using port 443.")
conn.close()
PY`,
  `python3 /tmp/fix_inbound.py`,
  `systemctl restart x-ui`,
  `sleep 2`,
  `systemctl status x-ui --no-pager`
];

conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD
});
