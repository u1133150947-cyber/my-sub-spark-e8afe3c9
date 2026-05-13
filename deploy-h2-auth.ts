import { Client } from 'ssh2';
import { readFileSync } from 'fs';

const conn = new Client();
const files = [
  ['server/main.ts', '/opt/sub-manager/server/main.ts'],
  ['server/sub.ts', '/opt/sub-manager/server/sub.ts'],
  ['server/hy2.ts', '/opt/sub-manager/server/hy2.ts'],
] as const;

function putFile(sftp: any, local: string, remote: string) {
  return new Promise<void>((resolve, reject) => {
    const data = readFileSync(local);
    sftp.writeFile(remote, data, (err: Error | null) => err ? reject(err) : resolve());
  });
}

conn.on('ready', () => {
  conn.sftp(async (err, sftp) => {
    if (err) throw err;
    try {
      for (const [local, remote] of files) {
        await putFile(sftp, local, remote);
        console.log('uploaded', local, '->', remote);
      }
      
      const setupDbCmd = `
sqlite3 /opt/sub-manager/data/app.db "CREATE TABLE IF NOT EXISTS standalone_servers (id TEXT PRIMARY KEY, name TEXT, host TEXT, port INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"
sqlite3 /opt/sub-manager/data/app.db "INSERT OR IGNORE INTO standalone_servers (id, name, host, port) VALUES ('cz', 'Hysteria 2 - CZ', 'reality.panelsu.ru', 443);"
sqlite3 /opt/sub-manager/data/app.db "INSERT OR IGNORE INTO standalone_servers (id, name, host, port) VALUES ('ru', 'Hysteria 2 - RU', 'realityru.panelsu.ru', 443);"
`;

      conn.exec(setupDbCmd + '\nsystemctl restart sub-manager && sleep 2 && systemctl is-active sub-manager && journalctl -u sub-manager -n 20 --no-pager', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
      });
    } catch (e) {
      console.error(e);
      conn.end();
      process.exitCode = 1;
    }
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
