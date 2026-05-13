import { Client } from "ssh2";
async function updateHysteria(ip, domain, pwd, port = ":8081") {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => {
      const config = `listen: :443
tls:
  cert: /root/.acme.sh/fullchain.cer
  key: /root/.acme.sh/${domain}.key
auth:
  type: http
  http:
    endpoint: https://web.panelsu.ru/api/hy2/auth
masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
trafficApi:
  listen: ${port}
`;
      const cmd = `cat << 'YAMLEOF' > /etc/hysteria/config.yaml
${config.trim()}
YAMLEOF
systemctl restart hysteria-server && sleep 2 && curl -s http://127.0.0.1${port}/traffic`;
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        let out = "";
        stream.on("close", () => { conn.end(); resolve(out); }).on("data", d => out += d).stderr.on("data", d => out += d);
      });
    }).on("error", reject).connect({ host: ip, port: 22, username: "root", password: pwd, readyTimeout: 10000 });
  });
}
async function main() {
  try {
    console.log("RU...");
    console.log(await updateHysteria("82.202.128.147", "realityru.panelsu.ru", "K!E2QAGrxYFx", ":8081"));
  } catch (e) { console.error("RU fail:", e.message); }
  try {
    console.log("CZ...");
    console.log(await updateHysteria("185.87.148.138", "reality.panelsu.ru", "hf6Ka8viMl", ":8081"));
  } catch (e) { console.error("CZ fail:", e.message); }
}
main();