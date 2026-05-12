import { Client } from 'ssh2';
async function run() {
  return new Promise<void>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      const script = `
        COOKIE_HEADER=$(curl -s -D - -X POST -d "username=admin&password=6WYia!Y5gV5D" http://127.0.0.1:2053/login | grep -i 'set-cookie')
        COOKIE=$(echo "$COOKIE_HEADER" | grep -o 'session=[^;]*')
        
        INBOUNDS=$(curl -s -b "$COOKIE" -H "Accept: application/json" http://127.0.0.1:2053/panel/api/inbounds/list)
        # Using python to parse json because grep is fragile
        ID=$(python3 -c "
import sys, json
data = json.load(sys.stdin)
h2 = next((x for x in data['obj'] if x['protocol'] == 'hysteria'), None)
if h2: print(h2['id'])
" <<< "$INBOUNDS")
        echo "ID: $ID"
        
        SETTINGS='{"clients":[{"id":"bbaacc-123","email":"test_3xui_api","enable":true,"password":"pass-abc"}]}'
        ADD=$(curl -s -X POST -b "$COOKIE" -H "Content-Type: application/x-www-form-urlencoded" -H "Accept: application/json" -d "id=$ID&settings=$SETTINGS" http://127.0.0.1:2053/panel/api/inbounds/addClient)
        echo "Add response: $ADD"
        
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
