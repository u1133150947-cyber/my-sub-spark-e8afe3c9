import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `sqlite3 /opt/sub-manager/data/app.db "SELECT id, slug, client_email FROM subscriptions WHERE slug = 'ejzyw1olmdgn7' OR slug = 'ejzyw1olmdgn';"`,
  `sqlite3 /opt/sub-manager/data/app.db "UPDATE subscriptions SET slug = 'ejzyw1olmdgn' WHERE slug = 'ejzyw1olmdgn7';"`,
  `sqlite3 /opt/sub-manager/data/app.db "SELECT id, slug, client_email FROM subscriptions WHERE slug = 'ejzyw1olmdgn';"`,
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
