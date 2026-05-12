import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `cat << 'PY' > /tmp/check_routing.py
import sqlite3
import json
db = '/etc/x-ui/x-ui.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()
try:
    cursor.execute("SELECT key, value FROM settings WHERE key='xrayTemplateConfig';")
    row = cursor.fetchone()
    if row:
        config = json.loads(row[1])
        routing = config.get('routing', {})
        print("Routing rules:")
        print(json.dumps(routing.get('rules', []), indent=2, ensure_ascii=False))
except Exception as e:
    print("Error:", e)
conn.close()
PY`,
  `python3 /tmp/check_routing.py`
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
