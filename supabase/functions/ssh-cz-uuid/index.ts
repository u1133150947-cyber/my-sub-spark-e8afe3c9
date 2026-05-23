import { Client } from "npm:ssh2@1.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const password = Deno.env.get("SSH_CZ_PASSWORD");
  if (!password) {
    return new Response(JSON.stringify({ error: "SSH_CZ_PASSWORD not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cmd = `cat /usr/local/x-ui/bin/config.json 2>/dev/null; echo '---'; cat /usr/local/etc/xray/config.json 2>/dev/null; echo '---'; cat /etc/xray/config.json 2>/dev/null; echo '---PANEL---'; cd /etc/x-ui && sqlite3 x-ui.db 'select id,remark,port,protocol,settings,stream_settings from inbounds;' 2>/dev/null`;

  const result = await new Promise<string>((resolve, reject) => {
    const conn = new Client();
    let out = "";
    conn
      .on("ready", () => {
        conn.exec(cmd, (err: any, stream: any) => {
          if (err) { conn.end(); return reject(err); }
          stream
            .on("close", () => { conn.end(); resolve(out); })
            .on("data", (d: Uint8Array) => { out += new TextDecoder().decode(d); })
            .stderr.on("data", (d: Uint8Array) => { out += "[stderr]" + new TextDecoder().decode(d); });
        });
      })
      .on("error", reject)
      .connect({
        host: "185.87.148.138",
        port: 22,
        username: "root",
        password,
        readyTimeout: 15000,
      });
  }).catch((e) => `ERROR: ${e.message || e}`);

  return new Response(JSON.stringify({ output: result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
