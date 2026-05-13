import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  conn.exec('curl -s -o /dev/null -w "google: %{http_code} %{time_total}\\n" https://google.com; curl -s -o /dev/null -w "youtube: %{http_code} %{time_total}\\n" https://youtube.com; curl -s -o /dev/null -w "cf: %{http_code} %{time_total}\\n" https://1.1.1.1; curl -s -o /dev/null -w "tg: %{http_code} %{time_total}\\n" --max-time 5 https://149.154.167.51; ip -4 route get 8.8.8.8', (err, stream) => {
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
