import { Client } from "ssh2";

async function main() {
  const czPass = process.env.PANEL_CZ_PASSWORD || "K!E2QAGrxYFx";
  const ruPass = process.env.PANEL_RU_PASSWORD || "K!E2QAGrxYFx";

  async function setupNode(ip: string, domain: string, password: string) {
    console.log("Found password for", ip, "trying to connect...");
    
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on("ready", () => {
        console.log(`Connected to ${ip}`);
        
        const config = `
listen: :443
tls:
  cert: /root/.acme.sh/${domain}_ecc/fullchain.cer
  key: /root/.acme.sh/${domain}_ecc/${domain}.key
auth:
  type: http
  http:
    endpoint: https://web.panelsu.ru/api/hy2/auth
masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
`;
        const cmd = `cat << 'YAMLEOF' > /etc/hysteria/config.yaml
${config.trim()}
YAMLEOF
systemctl restart hysteria-server.service && systemctl status hysteria-server.service --no-pager
`;
        conn.exec(cmd, (err: any, stream: any) => {
          if (err) { conn.end(); return reject(err); }
          let out = "";
          stream.on("close", () => { conn.end(); resolve(out); })
                .on("data", (d: any) => out += d)
                .stderr.on("data", (d: any) => out += d);
        });
      }).on("error", reject).connect({ host: ip, port: 22, username: "root", password });
    });
  }

  try {
    console.log("Configuring CZ...");
    const resCz = await setupNode("185.87.148.138", "reality.panelsu.ru", czPass);
    console.log(resCz);
    
    console.log("Configuring RU...");
    const resRu = await setupNode("82.202.128.147", "realityru.panelsu.ru", ruPass);
    console.log(resRu);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

main();
