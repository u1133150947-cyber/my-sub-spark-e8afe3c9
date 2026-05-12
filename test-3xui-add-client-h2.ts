import { Client } from 'ssh2';
async function run() {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      const script = `
        # Login and get session cookie
        COOKIE_HEADER=$(curl -s -D - -X POST -d "username=admin&password=6WYia!Y5gV5D" http://127.0.0.1:2053/login | grep -i 'set-cookie')
        COOKIE=$(echo "$COOKIE_HEADER" | grep -o 'session=[^;]*')
        echo "Cookie string: $COOKIE"

        # List inbounds
        INBOUNDS=$(curl -s -b "$COOKIE" -H "Accept: application/json" http://127.0.0.1:2053/panel/api/inbounds/list)
        # Extract Hysteria inbound ID using python/jq or just grep
        ID=$(echo "$INBOUNDS" | grep -o '"id":[0-9]*,"up":[^}]*"protocol":"hysteria"' | grep -o '"id":[0-9]*' | head -n 1 | cut -d':' -f2)
        echo "ID: $ID"
        
        # Test addClient
        SETTINGS='{"clients":[{"id":"bbaacc-123","email":"test_3xui_api","enable":true,"password":"pass-abc"}]}'
        ADD=$(curl -s -X POST -b "$COOKIE" -H "Content-Type: application/x-www-form-urlencoded" -H "Accept: application/json" --data-urlencode "id=$ID" --data-urlencode "settings=$SETTINGS" http://127.0.0.1:2053/panel/api/inbounds/addClient)
        echo "Add response: $ADD"
        
        # See what's inside the DB for this inbound now
        sqlite3 /etc/x-ui/x-ui.db "SELECT settings FROM inbounds WHERE id=$ID;"
        
        # See what's generated in config.json
        cat /usr/local/x-ui/bin/config.json | grep -A 20 '"protocol": "hysteria"'
      `;
      conn.exec(script, (err, stream) => {
        if (err) { console.error(err); conn.end(); resolve(); return; }
        stream.on('data', d => process.stdout.write(d)).on('close', () => { conn.end(); resolve(); });
      });
    }).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
  });
}
run();
