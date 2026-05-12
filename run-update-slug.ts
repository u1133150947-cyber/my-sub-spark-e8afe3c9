import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `cat << 'PY' > /tmp/update_slug.py
import sqlite3
db = '/opt/sub-manager/data/app.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()

# Check old
cursor.execute("SELECT id, slug, client_email FROM subscriptions WHERE slug = 'ejzyw1olmdgn7' OR slug = 'ejzyw1olmdgn'")
print("Before update:")
for row in cursor.fetchall():
    print(row)

# Update
cursor.execute("UPDATE subscriptions SET slug = 'ejzyw1olmdgn' WHERE slug = 'ejzyw1olmdgn7'")
conn.commit()

# Check new
cursor.execute("SELECT id, slug, client_email FROM subscriptions WHERE slug = 'ejzyw1olmdgn'")
print("After update:")
for row in cursor.fetchall():
    print(row)

conn.close()
PY`,
  `python3 /tmp/update_slug.py`
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
