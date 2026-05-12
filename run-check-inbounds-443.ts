import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `cat << 'PY' > /tmp/check_inbounds.py
import sqlite3
import json
db = '/etc/x-ui/x-ui.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()
cursor.execute("SELECT id, remark, port FROM inbounds WHERE port = 443;")
rows = cursor.fetchall()
for row in rows:
    print(f"Inbound ID: {row[0]}, Remark: {row[1]}, Port: {row[2]}")
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
