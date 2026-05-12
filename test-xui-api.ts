import { Client } from 'ssh2';
const h = { name: 'CZ', host: '185.87.148.138', password: 'hf6Ka8viMl' };
const cmd = `
curl -s -c cookie.txt -X POST -d 'username=admin&password=Z7xK#mN4vA$bC2yH9' http://127.0.0.1:35978/login > /dev/null
curl -s -b cookie.txt -X POST -d 'up=0&down=0&total=0&remark=ApiH2&enable=true&expiryTime=0&listen=&port=44434&protocol=hysteria&settings={"clients":[],"ignoreClientBandwidth":false,"disableInsecureEncryption":false,"version":2}&streamSettings={"network":"hysteria","security":"tls","tlsSettings":{"serverName":"cz.panelsu.ru","certificates":[{"certificateFile":"/root/cert/cz.panelsu.ru/fullchain.pem","keyFile":"/root/cert/cz.panelsu.ru/privkey.pem"}]}}&sniffing={"enabled":true,"destOverride":["http","tls","quic"],"routeOnly":false}' http://127.0.0.1:35978/panel/api/inbounds/add
sqlite3 /etc/x-ui/x-ui.db "SELECT protocol, settings, stream_settings FROM inbounds WHERE port=44434;"
`;
const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d)).on('close', () => conn.end());
  });
}).connect({ host: h.host, port: 22, username: 'root', password: h.password });