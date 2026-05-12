import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `cat << 'PY' > /tmp/check_schema.py
import sqlite3
db = '/opt/sub-manager/data/app.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()
cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table';")
for row in cursor.fetchall():
    print(row[1])
conn.close()
PY`,
  `python3 /tmp/check_schema.py`
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
