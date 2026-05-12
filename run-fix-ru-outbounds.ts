import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `cat << 'PY' > /tmp/fix_outbounds.py
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
        outbounds = config.get('outbounds', [])
        updated = False
        for out in outbounds:
            if 'settings' in out and 'vnext' in out['settings']:
                for vnext in out['settings']['vnext']:
                    if vnext.get('port') == 8443 and 'cz' in str(out.get('tag', '')).lower():
                        vnext['port'] = 2080
                        updated = True
                        print("Updated outbound port for tag:", out.get('tag'))
        
        if updated:
            new_val = json.dumps(config)
            cursor.execute("UPDATE settings SET value=? WHERE key='xrayTemplateConfig';", (new_val,))
            conn.commit()
            print("Successfully saved updated outbounds to DB.")
        else:
            print("No matching outbounds found to update.")
except Exception as e:
    print("Error:", e)
conn.close()
PY`,
  `python3 /tmp/fix_outbounds.py`,
  `systemctl restart x-ui`
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
