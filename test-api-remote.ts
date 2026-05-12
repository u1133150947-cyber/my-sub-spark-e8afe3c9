import { Client } from 'ssh2';
async function run() {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      const script = `
        COOKIE=$(curl -s -c - -X POST -d "username=admin&password=admin" http://127.0.0.1:2053/login | grep session | awk '{print $7}')
        curl -s -H "Cookie: session=$COOKIE" http://127.0.0.1:2053/panel/api/inbounds/list > /tmp/inbounds.json
        cat /tmp/inbounds.json
      `;
      conn.exec(script, (err, stream) => {
        if (err) { console.error(err); conn.end(); resolve(); return; }
        stream.on('data', d => process.stdout.write(d)).on('close', () => { conn.end(); resolve(); });
      });
    }).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
  });
}
run();
