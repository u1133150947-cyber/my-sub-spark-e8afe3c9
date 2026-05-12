const { Client } = require('ssh2');

const host = "185.87.148.138";
const user = "root";
const password = "hf6Ka8viMl";
const domain = "3xcz.panelsu.ru";

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  
  const cmd = [
    `if ! test -x /root/.acme.sh/acme.sh; then curl -fsSL https://get.acme.sh | sh -s email=admin@${domain}; fi`,
    `/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt`,
    `systemctl stop x-ui nginx caddy apache2 2>/dev/null || true`,
    `/root/.acme.sh/acme.sh --issue -d ${domain} --standalone --httpport 80 --force`,
    `mkdir -p /root/cert/${domain}`,
    `/root/.acme.sh/acme.sh --installcert -d ${domain} --key-file /root/cert/${domain}/privkey.pem --fullchain-file /root/cert/${domain}/fullchain.pem`,
    `/usr/local/x-ui/x-ui cert -webCert /root/cert/${domain}/fullchain.pem -webCertKey /root/cert/${domain}/privkey.pem`,
    `systemctl start nginx caddy apache2 2>/dev/null || true`,
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
