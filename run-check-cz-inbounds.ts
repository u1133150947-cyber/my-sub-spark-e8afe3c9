import { Client } from 'ssh2';

const conn = new Client();
const HOST = 'cz.panelsu.ru';
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

const commands = [
  `cat << 'PY' > /tmp/check_inbounds.py
import sqlite3
db = '/etc/x-ui/x-ui.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()
cursor.execute("SELECT id, remark, port FROM inbounds;")
rows = cursor.fetchall()
if rows:
    for row in rows:
        print(f"Inbound ID: {row[0]}, Remark: {row[1]}, Port: {row[2]}")
else:
    print("No inbounds found.")
conn.close()
PY`,
  `python3 /tmp/check_inbounds.py`
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
