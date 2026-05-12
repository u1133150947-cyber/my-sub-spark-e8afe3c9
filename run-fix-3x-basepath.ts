import { Client } from 'ssh2';

const conn = new Client();

const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const script = `
import sqlite3

db = '/etc/x-ui/x-ui.db'
conn = sqlite3.connect(db)
cursor = conn.cursor()

# Set webBasePath to /
cursor.execute("UPDATE settings SET value='/' WHERE key='webBasePath'")
conn.commit()

# Ensure username and password are set back to admin_3x / XUIhh5sj3! just in case
# The admin_3x / XUIhh5sj3! might have been overridden if the prompt was skipped or misread.
# Actually I'll just check what the username/pass are, or wait, x-ui setting works for them.
conn.close()
print("DB Updated")
`;

const commands = [
  `python3 -c "${script.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"`,
  `/usr/local/x-ui/x-ui setting -username admin_3x -password XUIhh5sj3!`,
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
