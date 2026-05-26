import { Client } from 'ssh2';

// Test FI xHTTP via xray client running on RU server (so we test outbound to FI:8447)
const config = {
  log: { loglevel: "warning" },
  inbounds: [{ port: 10808, listen: "127.0.0.1", protocol: "socks", settings: { auth: "noauth", udp: true } }],
  outbounds: [{
    protocol: "vless",
    settings: {
      vnext: [{
        address: "fi.panelsu.ru", port: 8447,
        users: [{ id: "513d27a8-fd5e-4a45-a467-2602a3bc591b", encryption: "none", flow: "" }]
      }]
    },
    streamSettings: {
      network: "xhttp", security: "reality",
      realitySettings: {
        serverName: "www.google.com",
        fingerprint: "chrome",
        publicKey: "WxmuIhikP4wG-YttGH5nVezZi-6Ua1Qd71py3tzsEts",
        shortId: "d72b26daaf0254a3",
        spiderX: "/"
      },
      xhttpSettings: { path: "/fi-xh", mode: "auto" }
    }
  }]
};

const cfgB64 = Buffer.from(JSON.stringify(config)).toString('base64');
const cmd = `pkill -f "xray.*xhttp_test" 2>/dev/null; sleep 1; echo '${cfgB64}' | base64 -d > /tmp/xhttp_test.json && nohup /usr/local/x-ui/bin/xray-linux-amd64 run -config /tmp/xhttp_test.json > /tmp/xhttp_test.log 2>&1 & sleep 3 && echo "--- LOG ---" && cat /tmp/xhttp_test.log && echo "--- TEST via SOCKS ---" && curl -sx socks5h://127.0.0.1:10808 --max-time 20 -o /dev/null -w "HTTP %{http_code} | %{time_total}s | %{remote_ip}\\n" https://www.cloudflare.com/cdn-cgi/trace 2>&1; echo "--- TRACE ---" && curl -sx socks5h://127.0.0.1:10808 --max-time 20 https://www.cloudflare.com/cdn-cgi/trace 2>&1 | head -10; pkill -f xhttp_test`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (d: any) => process.stdout.write(d.toString()))
      .stderr.on('data', (d: any) => process.stderr.write(d.toString()));
  });
}).connect({ host: '87.121.105.143', port: 22, username: 'root', password: 'f4OQrEBYUQnEmwkgqPnwDD', readyTimeout: 15000 });