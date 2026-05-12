const { Client } = require('ssh2');

const host = "62.217.181.79";
const user = "root";
const password = "6WYia!Y5gV5D";
const domain = "3xru.panelsu.ru";
const panel_username = "admin";
const panel_password = "6WYia!Y5gV5D";
const panel_port = 2053;
const panel_path = "admin";

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  
  const cmd = [
    `bash -c 'set -o pipefail; printf "n\\n4\\n" | bash <(curl -fsSL https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh) v2.6.7'`,
    `/usr/local/x-ui/x-ui setting -username admin -password "6WYia!Y5gV5D" -port 2053 -webBasePath admin`,
    `if ! test -x /root/.acme.sh/acme.sh; then curl -fsSL https://get.acme.sh | sh -s email=admin@${domain}; fi`,
    `/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt`,
    `systemctl stop x-ui nginx caddy apache2 2>/dev/null || true`,
    `/root/.acme.sh/acme.sh --issue -d ${domain} --standalone --httpport 80 --force`,
    `mkdir -p /root/cert/${domain}`,
    `/root/.acme.sh/acme.sh --installcert -d ${domain} --key-file /root/cert/${domain}/privkey.pem --fullchain-file /root/cert/${domain}/fullchain.pem`,
    `/usr/local/x-ui/x-ui cert -webCert /root/cert/${domain}/fullchain.pem -webCertKey /root/cert/${domain}/privkey.pem`,
    `x-ui restart`
  ].join(" && ");
  
  conn.exec(cmd, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect({
  host,
  port: 22,
  username: user,
  password,
  tryKeyboard: true,
  algorithms: {
    cipher: ["aes128-ctr", "aes192-ctr", "aes256-ctr", "aes128-cbc", "aes256-cbc"],
  }
});
