import { Client } from 'ssh2';
const c = new Client();
const cmd = `
ss -lntp | grep 40000 || echo 'no listener on 40000'
echo '---'
curl -s --max-time 10 -x socks5h://127.0.0.1:40000 https://www.cloudflare.com/cdn-cgi/trace/ || echo curl_failed
echo '---'
curl -s --max-time 10 -x socks5h://127.0.0.1:40000 https://api.ipify.org && echo
echo '--- direct ---'
curl -s --max-time 10 https://api.ipify.org && echo
`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
