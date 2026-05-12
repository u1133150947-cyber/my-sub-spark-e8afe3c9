import { Client } from 'ssh2';
async function run() {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      const script = `
        # Login and get session cookie + token if any
        RES=$(curl -s -i -X POST -d "username=admin&password=6WYia!Y5gV5D" http://127.0.0.1:2053/login)
        COOKIE=$(echo "$RES" | grep -i 'set-cookie' | head -n 1 | awk '{print $2}' | sed 's/;//')
        echo "Cookie: $COOKIE"

        # List inbounds
        INBOUNDS=$(curl -s -H "Cookie: $COOKIE" -H "Accept: application/json" http://127.0.0.1:2053/panel/api/inbounds/list)
        # Extract Hysteria inbound ID
        ID=$(echo "$INBOUNDS" | grep -o '"id":[0-9]*,"up"' | head -n 1 | grep -o '[0-9]*')
        echo "ID: $ID"
        
        # Test addClient
        SETTINGS='{"clients":[{"id":"abc-123","email":"test_3xui_api","enable":true,"password":"abc-123"}]}'
        ADD=$(curl -s -X POST -H "Cookie: $COOKIE" -H "Content-Type: application/x-www-form-urlencoded" -H "Accept: application/json" -d "id=$ID&settings=$SETTINGS" http://127.0.0.1:2053/panel/api/inbounds/addClient)
        echo "Add response: $ADD"
        
        # See what's inside the DB for this inbound now
        sqlite3 /etc/x-ui/x-ui.db "SELECT settings FROM inbounds WHERE id=$ID;"
      `;
      conn.exec(script, (err, stream) => {
        if (err) { console.error(err); conn.end(); resolve(); return; }
        stream.on('data', d => process.stdout.write(d)).on('close', () => { conn.end(); resolve(); });
      });
    }).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
  });
}
run();
