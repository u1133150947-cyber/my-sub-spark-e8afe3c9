import { Client } from 'ssh2';

async function queryRemoteUUID() {
  return new Promise<string>((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec('sqlite3 /opt/sub-manager/data/app.db "SELECT client_uuid FROM subscriptions LIMIT 1;"', (err, stream) => {
        let out = '';
        stream.on('close', () => { conn.end(); resolve(out.trim()); })
          .on('data', d => out += d);
      });
    }).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
  });
}

async function testConnection(ip: string, domain: string, pwd: string, auth: string) {
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      const cmd = `cat << "YAML" > /tmp/hy2-client.yaml
server: ${domain}:443
tls:
  sni: ${domain}
  insecure: false
auth: ${auth}
YAML
timeout 5 /usr/local/bin/hysteria client -c /tmp/hy2-client.yaml
`;
      conn.exec(cmd, (err, stream) => {
        let out = '';
        stream.on('close', () => { conn.end(); resolve(out); })
          .on('data', d => out += d).stderr.on('data', d => out += d);
      });
    }).connect({ host: ip, port: 22, username: 'root', password: pwd });
  });
}

async function main() {
  const uuid = await queryRemoteUUID();
  if (!uuid) {
    console.log("No subscriptions found!");
    return;
  }
  console.log("Using UUID:", uuid);

  console.log("Testing CZ...");
  console.log(await testConnection("185.87.148.138", "reality.panelsu.ru", "hf6Ka8viMl", uuid));
  
  console.log("Testing RU...");
  console.log(await testConnection("82.202.128.147", "realityru.panelsu.ru", "K!E2QAGrxYFx", uuid));
}

main();
