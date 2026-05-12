import { Client } from 'ssh2';

const conn = new Client();

const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `cat << 'PY' > /tmp/fix_db.py
import sqlite3
db = '/etc/x-ui/x-ui.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()
cursor.execute("UPDATE settings SET value='/' WHERE key='webBasePath'")
conn.commit()
conn.close()
print("DB Updated")
PY`,
  `python3 /tmp/fix_db.py`,
  `systemctl restart x-ui`,
  `sleep 2`,
  `/usr/local/x-ui/x-ui setting -show`,
  `curl -I http://127.0.0.1:2053/login`
];

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('--- SUCCESS ---');
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
