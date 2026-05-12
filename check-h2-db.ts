import { Client } from 'ssh2';
async function run() {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec('sqlite3 /etc/x-ui/x-ui.db "SELECT settings FROM inbounds WHERE protocol=\'hysteria\' LIMIT 1;"', (err, stream) => {
        if (err) { console.error(err); conn.end(); resolve(); return; }
        stream.on('data', d => process.stdout.write(d)).on('close', () => { conn.end(); resolve(); });
      });
    }).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
  });
}
run();
