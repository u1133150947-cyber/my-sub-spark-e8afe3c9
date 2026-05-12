import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `cat << 'PY' > /tmp/check_outbounds.py
import sqlite3
import json
db = '/etc/x-ui/x-ui.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()
# The panel stores outbounds in settings usually, or they are configured in the web UI config.
# In 3x-ui, outbounds are in a separate table maybe? Or inside settings json?
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tables:", tables)

try:
    cursor.execute("SELECT key, value FROM settings WHERE key='xrayTemplateConfig';")
    row = cursor.fetchone()
    if row:
        config = json.loads(row[1])
        outbounds = config.get('outbounds', [])
        for out in outbounds:
            if out.get('tag') == 'cz' or 'cz' in str(out):
                print("Found outbound:", json.dumps(out))
except Exception as e:
    print("Error:", e)
conn.close()
PY`,
  `python3 /tmp/check_outbounds.py`
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
