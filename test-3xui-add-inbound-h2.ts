import { Client } from 'ssh2';
async function run() {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      const script = `
        # Login and get session cookie
        COOKIE_HEADER=$(curl -s -D - -X POST -d "username=admin&password=6WYia!Y5gV5D" http://127.0.0.1:2053/login | grep -i 'set-cookie')
        COOKIE=$(echo "$COOKIE_HEADER" | grep -o 'session=[^;]*')

        # Add a new Hysteria inbound
        SETTINGS='{"hysterias":[{"auth":"test-auth","password":"test-password"}],"version":2}'
        # Wait, I don't know the exact JSON format for settings.
        # Let's just create an inbound with protocol hysteria and empty settings via panel API, then add a client.
        
        # Actually, let's just grep the x-ui source code on the server if it's there? No, it's a binary.
      `;
      conn.exec(script, (err, stream) => {
        if (err) { console.error(err); conn.end(); resolve(); return; }
        stream.on('data', d => process.stdout.write(d)).on('close', () => { conn.end(); resolve(); });
      });
    }).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
  });
}
run();
