import { Client } from 'ssh2';
function ssh(host: string, password: string, cmd: string) {
  return new Promise<string>((resolve) => {
    const c = new Client();
    let out = '';
    c.on('ready', () => c.exec(cmd, (err, s) => {
      if (err) { resolve(String(err)); return; }
      s.on('close', () => { c.end(); resolve(out); })
       .on('data', d => out += d.toString())
       .stderr.on('data', d => out += d.toString());
    })).on('error', e => resolve('SSH err: '+e.message))
      .connect({ host, port: 22, username: 'root', password, readyTimeout: 15000 });
  });
}
const pw = process.env.PANEL_CZ_PASSWORD!;
const cmd = `
set +e
echo '=== hysteria config ==='; ls /etc/hysteria/ 2>/dev/null; cat /etc/hysteria/config.yaml 2>/dev/null
echo '=== warp settings ==='; warp-cli --accept-tos settings 2>/dev/null | head -50
echo '=== warp status ==='; warp-cli --accept-tos status 2>/dev/null
echo '=== warp mode ==='; warp-cli --accept-tos mode 2>/dev/null
echo '=== mtu of CloudflareWARP ==='; ip link show CloudflareWARP 2>/dev/null | head -3
echo '=== sysctl ==='; sysctl net.core.rmem_max net.core.wmem_max net.ipv4.tcp_congestion_control 2>/dev/null
echo '=== hysteria-server status ==='; systemctl is-active hysteria-server; systemctl show hysteria-server -p MainPID -p ActiveState
`;
console.log(await ssh('185.87.148.138', pw, cmd));
