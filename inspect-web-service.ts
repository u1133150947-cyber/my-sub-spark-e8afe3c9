import { Client } from 'ssh2';
const conn = new Client();
const cmd = "systemctl list-units --type=service --all | grep -i -E 'sub|deno|manager|web' || true; systemctl status sub-manager --no-pager 2>/dev/null || true; systemctl status sub-manager.service --no-pager 2>/dev/null || true; ls -la /etc/systemd/system | grep -i -E 'sub|manager|deno|web' || true";
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
