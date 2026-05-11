// 3X-UI auto-installer over SSH.
// Connects via npm:ssh2, runs the official MHSanaei install script
// (or detects an existing installation), then forces the requested
// admin credentials/port/web-path via the `x-ui setting` CLI.
//
// Designed to be safe to call multiple times — if x-ui is already
// installed it just re-applies settings.
import { Client } from "npm:ssh2@1.15.0";
import { db, uid } from "./db.ts";
import { verifyAdminSession, unauthorizedResponse } from "./auth.ts";
import { bustPanelsCache } from "./x3ui.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const XUI_BIN = "/usr/local/x-ui/x-ui";

type SSHOpts = {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  readyTimeout?: number;
};

function sshConnect(opts: SSHOpts): Promise<Client> {
  return new Promise((resolve, reject) => {
    const c = new Client();
    const cfg: any = {
      host: opts.host,
      port: opts.port || 22,
      username: opts.username,
      readyTimeout: opts.readyTimeout ?? 20000,
      tryKeyboard: true,
      algorithms: {
        cipher: ["aes128-ctr", "aes192-ctr", "aes256-ctr", "aes128-cbc", "aes256-cbc"],
      },
    };
    if (opts.privateKey) cfg.privateKey = opts.privateKey;
    if (opts.passphrase) cfg.passphrase = opts.passphrase;
    if (opts.password) cfg.password = opts.password;
    c.on("ready", () => resolve(c));
    c.on("error", reject);
    c.on("keyboard-interactive", (_n: any, _i: any, _l: any, _p: any, finish: (a: string[]) => void) => {
      finish([opts.password ?? ""]);
    });
    c.connect(cfg);
  });
}

function execSsh(c: Client, cmd: string, timeoutMs = 600_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    c.exec(cmd, { pty: true }, (err: any, stream: any) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      const t = setTimeout(() => {
        try { stream.close(); } catch {}
        reject(new Error(`SSH command timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
      stream.on("close", (code: number) => {
        clearTimeout(t);
        resolve({ code: code ?? 0, stdout, stderr });
      });
      stream.on("data", (d: Buffer) => { stdout += d.toString("utf-8"); });
      stream.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
    });
  });
}

function shQuote(v: string): string {
  // Escape for double-quoted bash context.
  return `"${String(v).replace(/(["\\$`])/g, "\\$1")}"`;
}

function defaultLetsEncryptEmail(domain?: string): string {
  const suffix = (domain ?? "example.com").split(".").slice(-2).join(".") || "example.com";
  return `admin-${crypto.randomUUID().slice(0, 8)}@${suffix}`;
}

type InstallParams = {
  // SSH
  host: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_auth?: "password" | "key";
  ssh_password?: string;
  ssh_private_key?: string;
  ssh_passphrase?: string;
  // Panel
  mode: "ip" | "domain";
  domain?: string;
  panel_port: number;
  panel_path?: string;
  panel_username: string;
  panel_password: string;
  // Optional auto-register
  save?: boolean;
  name?: string;
  country?: string;
  letsencrypt_email?: string;
};

function validate(p: any): { ok: true; v: InstallParams } | { ok: false; error: string } {
  const errs: string[] = [];
  if (!p?.host || typeof p.host !== "string") errs.push("host обязателен");
  if (!p?.panel_username || String(p.panel_username).length < 3) errs.push("panel_username ≥ 3 символа");
  if (!p?.panel_password || String(p.panel_password).length < 6) errs.push("panel_password ≥ 6 символов");
  const port = Number(p?.panel_port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errs.push("panel_port 1–65535");
  const mode = p?.mode === "domain" ? "domain" : "ip";
  if (mode === "domain" && !p?.domain) errs.push("domain обязателен при mode=domain");
  const auth = p?.ssh_auth === "key" ? "key" : "password";
  if (auth === "password" && !p?.ssh_password) errs.push("ssh_password обязателен");
  if (auth === "key" && !p?.ssh_private_key) errs.push("ssh_private_key обязателен");
  if (errs.length) return { ok: false, error: errs.join("; ") };
  return {
    ok: true,
    v: {
      host: String(p.host).trim(),
      ssh_port: Number(p.ssh_port) || 22,
      ssh_user: String(p.ssh_user || "root").trim(),
      ssh_auth: auth,
      ssh_password: p.ssh_password ? String(p.ssh_password) : undefined,
      ssh_private_key: p.ssh_private_key ? String(p.ssh_private_key) : undefined,
      ssh_passphrase: p.ssh_passphrase ? String(p.ssh_passphrase) : undefined,
      mode,
      domain: p.domain ? String(p.domain).trim() : undefined,
      panel_port: port,
      panel_path: p.panel_path ? String(p.panel_path).trim().replace(/^\/+|\/+$/g, "") : "",
      panel_username: String(p.panel_username).trim(),
      panel_password: String(p.panel_password),
      save: !!p.save,
      name: p.name ? String(p.name).trim() : undefined,
      country: p.country ? String(p.country).trim().toUpperCase() : undefined,
      letsencrypt_email: p.letsencrypt_email ? String(p.letsencrypt_email).trim() : undefined,
    },
  };
}

async function runInstall(v: InstallParams): Promise<{ ok: boolean; panel_url?: string; log: string; error?: string }> {
  const log: string[] = [];
  const push = (s: string) => log.push(s.replace(/\r/g, ""));

  let client: Client;
  try {
    push(`→ SSH ${v.ssh_user}@${v.host}:${v.ssh_port}`);
    client = await sshConnect({
      host: v.host,
      port: v.ssh_port!,
      username: v.ssh_user!,
      password: v.ssh_auth === "password" ? v.ssh_password : undefined,
      privateKey: v.ssh_auth === "key" ? v.ssh_private_key : undefined,
      passphrase: v.ssh_passphrase,
    });
    push(`✓ SSH connected`);
  } catch (e: any) {
    return { ok: false, log: `${log.join("\n")}\n✗ SSH connect failed: ${e?.message ?? e}`, error: `SSH: ${e?.message ?? e}` };
  }

  const run = async (cmd: string, label?: string, timeout = 600_000) => {
    push(`$ ${label ?? cmd}`);
    const r = await execSsh(client, cmd, timeout);
    const out = (r.stdout + (r.stderr ? `\n[stderr]\n${r.stderr}` : "")).trim();
    if (out) push(out.length > 4000 ? out.slice(0, 4000) + "\n…(truncated)" : out);
    push(`(exit ${r.code})`);
    return r;
  };

  try {
    // 1) System info
    await run(`uname -a; cat /etc/os-release 2>/dev/null | head -n 5`, "system info");

    // 2) Detect existing x-ui
    const detect = await run(`command -v x-ui >/dev/null && x-ui status || echo NOT_INSTALLED`, "detect x-ui");
    const alreadyInstalled = !/NOT_INSTALLED/.test(detect.stdout);

    if (!alreadyInstalled) {
      push(`• x-ui not detected — running official installer`);
      // Pipe answers to decline the interactive "customize panel" prompt and skip the installer's
      // SSL wizard; credentials/port/cert are applied non-interactively below.
      // Use bash -c with set -o pipefail so installer failures bubble up.
      const inst = await run(
        `bash -c 'set -o pipefail; printf "n\\n4\\n" | bash <(curl -fsSL https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)'`,
        "install 3x-ui",
        900_000,
      );
      if (inst.code !== 0) {
        try { client.end(); } catch {}
        return { ok: false, log: log.join("\n"), error: `installer exit ${inst.code}` };
      }
    } else {
      push(`• x-ui already installed — will only re-apply settings`);
    }

    // 3) Apply credentials / port / base path via CLI.
    const baseFlag = v.panel_path ? ` -webBasePath ${shQuote(v.panel_path)}` : "";
    const setCmd = `${XUI_BIN} setting -username ${shQuote(v.panel_username)} -password ${shQuote(v.panel_password)} -port ${v.panel_port}${baseFlag}`;
    const setRes = await run(setCmd, "x-ui setting (creds/port/path)");
    if (setRes.code !== 0) {
      try { client.end(); } catch {}
      return { ok: false, log: log.join("\n"), error: `x-ui setting exit ${setRes.code}` };
    }

    // 4) Optional Let's Encrypt for domain mode. The x-ui CLI does not issue certs by
    // domain/email directly, so use acme.sh then point the panel to the generated files.
    if (v.mode === "domain" && v.domain) {
      const email = v.letsencrypt_email || defaultLetsEncryptEmail(v.domain);
      const certDir = `/root/cert/${v.domain}`;
      await run(`mkdir -p ${shQuote(certDir)}`, "prepare cert directory");
      const certCmd = [
        `if ! test -x /root/.acme.sh/acme.sh; then curl -fsSL https://get.acme.sh | sh -s email=${shQuote(email)}; fi`,
        `/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt`,
        `systemctl stop x-ui nginx caddy apache2 2>/dev/null || true`,
        `/root/.acme.sh/acme.sh --issue -d ${shQuote(v.domain)} --standalone --httpport 80 --force`,
        `/root/.acme.sh/acme.sh --installcert -d ${shQuote(v.domain)} --key-file ${shQuote(`${certDir}/privkey.pem`)} --fullchain-file ${shQuote(`${certDir}/fullchain.pem`)} --reloadcmd "systemctl restart x-ui || true" || true`,
        `test -s ${shQuote(`${certDir}/fullchain.pem`)} -a -s ${shQuote(`${certDir}/privkey.pem`)}`,
        `${XUI_BIN} cert -webCert ${shQuote(`${certDir}/fullchain.pem`)} -webCertKey ${shQuote(`${certDir}/privkey.pem`)}`,
        `systemctl start nginx caddy apache2 2>/dev/null || true`,
      ].join(" && ");
      await run(certCmd, `Let's Encrypt certificate for ${v.domain}`);
    }

    // 5) Open firewall port (best-effort, ignore errors on systems without ufw).
    await run(`ufw allow ${v.panel_port}/tcp 2>/dev/null || true`, `ufw allow ${v.panel_port}`);

    // 6) Restart.
    const restart = await run(`x-ui restart`, "x-ui restart");
    if (restart.code !== 0) {
      try { client.end(); } catch {}
      return { ok: false, log: log.join("\n"), error: `x-ui restart exit ${restart.code}` };
    }

    try { client.end(); } catch {}

    const scheme = v.mode === "domain" ? "https" : "http";
    const hostPart = v.mode === "domain" ? v.domain! : v.host;
    const pathPart = v.panel_path ? `/${v.panel_path}` : "";
    const panel_url = `${scheme}://${hostPart}:${v.panel_port}${pathPart}`;
    push(`✓ panel URL: ${panel_url}`);
    return { ok: true, panel_url, log: log.join("\n") };
  } catch (e: any) {
    try { client.end(); } catch {}
    return { ok: false, log: `${log.join("\n")}\n✗ ${e?.message ?? e}`, error: e?.message ?? String(e) };
  }
}

function autoSlug() {
  return "p" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function savePanelRow(v: InstallParams, panel_url: string): { id: string; slug: string } {
  const id = uid();
  const slug = autoSlug();
  const name = (v.name && v.name.trim()) || (v.mode === "domain" ? v.domain! : v.host);
  const host = v.mode === "domain" ? v.domain! : v.host;
  const country = v.country ?? "";
  db.query(
    `INSERT INTO panels (id, slug, name, host, public_host, panel_url, username, password, country, ssh_user, ssh_port, ssh_auth_type, ssh_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, slug, name, host, host, panel_url,
      v.panel_username, v.panel_password, country,
      v.ssh_user ?? "root", v.ssh_port ?? 22,
      v.ssh_auth ?? "password",
      v.ssh_auth === "password" ? (v.ssh_password ?? "") : "",
    ],
  );
  bustPanelsCache();
  return { id, slug };
}

export async function handleInstall(req: Request, _url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!verifyAdminSession(req)) return unauthorizedResponse(cors);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
  const v = validate(body);
  if (!v.ok) return json({ error: v.error }, 400);

  const result = await runInstall(v.v);
  if (!result.ok) return json(result, 500);

  let saved: { id: string; slug: string } | undefined;
  if (v.v.save) {
    try { saved = savePanelRow(v.v, result.panel_url!); }
    catch (e: any) { return json({ ...result, save_error: e?.message ?? String(e) }, 200); }
  }
  return json({ ...result, saved });
}