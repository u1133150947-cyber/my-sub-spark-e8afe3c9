import { Client } from 'ssh2';
const conn = new Client();
const cmd = String.raw`
pwd
ps aux | grep -E 'deno|server/main|8080' | grep -v grep || true
ls -la /root /opt /var/www 2>/dev/null || true
for db in /root/data/app.db /dev-server/data/app.db /opt/*/data/app.db /var/www/*/data/app.db; do
  if [ -f "$db" ]; then
    echo "DB=$db"
    sqlite3 "$db" "SELECT name, panel_url, username, host, public_host, slug FROM panels;" || true
  fi
done
`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
