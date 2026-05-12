import { Client } from 'ssh2';

const conn = new Client();

const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const panelUser = 'admin_3x';
const panelPass = 'XUIhh5sj3!';

conn.on('ready', () => {
  const script = `
  rm -f cookies.txt
  curl -s -c cookies.txt -X POST http://127.0.0.1:2053/login -d "username=${panelUser}&password=${panelPass}"
  echo "---"
  curl -s -b cookies.txt -X POST http://127.0.0.1:2053/server/installXray/v25.8.29
  echo "---"
  `;
  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD
});
