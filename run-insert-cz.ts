import { Client } from 'ssh2';
const conn = new Client();
const sql = `
INSERT INTO inbounds (user_id, up, down, total, all_time, remark, enable, expiry_time, listen, port, protocol, settings, stream_settings, tag, sniffing, traffic_reset, last_traffic_reset_time, node_id)
VALUES (
  1, 0, 0, 0, 0, '🚀 Hysteria Европа (Direct)', 1, 0, '', 44433, 'hysteria2',
  '{"clients":[]}',
  '{"network":"hysteria2","security":"tls","tlsSettings":{"serverName":"cz.panelsu.ru","certificates":[{"certificateFile":"/root/cert/cz.panelsu.ru/fullchain.pem","keyFile":"/root/cert/cz.panelsu.ru/privkey.pem"}]}}',
  'inbound-44433',
  '{"enabled":true,"destOverride":["http","tls","quic"],"routeOnly":false}',
  'never', 0, NULL
);
`;

const cmd = `cat << 'SQL' > /tmp/add.sql
${sql}
SQL
sqlite3 /etc/x-ui/x-ui.db < /tmp/add.sql && systemctl restart x-ui
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString()));
  });
}).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
