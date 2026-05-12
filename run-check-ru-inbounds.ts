import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const script = `
import sqlite3
import json

db = '/etc/x-ui/x-ui.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()
cursor.execute("SELECT id, remark, port, protocol, settings, stream_settings, tag FROM inbounds;")
rows = cursor.fetchall()
for row in rows:
    print(f"ID: {row[0]}, Remark: {row[1]}, Port: {row[2]}, Tag: {row[6]}")
conn.close()
`;

conn.on('ready', () => {
  conn.exec(`python3 -c "${script.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`, (err, stream) => {
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
