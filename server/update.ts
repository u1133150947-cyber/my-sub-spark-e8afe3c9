// Self-update endpoint: receive an archive (.zip or .tar.gz) and apply it in-place.
// Protected by Caddy basic-auth in front; we additionally require an env-set token if provided.
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { db } from "./db.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const APP_DIR = Deno.env.get("APP_DIR") ?? "/opt/sub-manager";
const UPDATE_TOKEN = Deno.env.get("UPDATE_TOKEN") ?? ""; // optional extra check
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") ?? "u1133150947-cyber/my-sub-spark-df6a54d2";
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") ?? "main";

function isoNow() { return new Date().toISOString(); }

function verifyAdminSession(req: Request): boolean {
  const token = req.headers.get("x-admin-token") ?? "";
  if (!token) return false;
  try {
    const rows = db.queryEntries(
      `SELECT token FROM admin_sessions WHERE token = ? AND datetime(expires_at) > datetime(?) LIMIT 1`,
      [token, isoNow()],
    );
    return rows.length > 0;
  } catch { return false; }
}

async function backupData(push: (s: string) => void): Promise<void> {
  const dataDir = join(APP_DIR, "data");
  try { await Deno.stat(dataDir); } catch { push("data/ not found — skipping backup"); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupsDir = join(APP_DIR, "backups");
  await Deno.mkdir(backupsDir, { recursive: true });
  const dest = join(backupsDir, `data-${stamp}.tar.gz`);
  const r = await run(["tar", "-czf", dest, "-C", APP_DIR, "data"]);
  if (!r.ok) throw new Error(`backup failed: ${r.out}`);
  push(`💾 backup: ${dest}`);
  try {
    const files: { name: string; mtime: number }[] = [];
    for await (const e of Deno.readDir(backupsDir)) {
      if (e.isFile && e.name.startsWith("data-") && e.name.endsWith(".tar.gz")) {
        const st = await Deno.stat(join(backupsDir, e.name));
        files.push({ name: e.name, mtime: st.mtime?.getTime() ?? 0 });
      }
    }
    files.sort((a, b) => b.mtime - a.mtime);
    for (const old of files.slice(5)) {
      await Deno.remove(join(backupsDir, old.name));
      push(`🗑 old backup removed: ${old.name}`);
    }
  } catch (e) { push(`backup cleanup warn: ${e instanceof Error ? e.message : String(e)}`); }
}

function publicOrigin(req: Request, url: URL) {
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

async function ensureEnv(req: Request, url: URL) {
  const envPath = join(APP_DIR, ".env");
  try {
    const current = await Deno.readTextFile(envPath);
    if (current.includes("VITE_SUPABASE_URL=") && current.includes("VITE_SUPABASE_PUBLISHABLE_KEY=")) return false;
  } catch {}
  const base = publicOrigin(req, url);
  await Deno.writeTextFile(envPath, [
    `VITE_SUPABASE_URL=${base}`,
    "VITE_SUPABASE_PUBLISHABLE_KEY=local-anon-key",
    "VITE_SUPABASE_PROJECT_ID=local",
    `VITE_SUB_BASE_URL=${base}/sub`,
    "",
  ].join("\n"));
  return true;
}

async function run(cmd: string[], cwd?: string): Promise<{ ok: boolean; out: string }> {
  try {
    const p = new Deno.Command(cmd[0], { args: cmd.slice(1), cwd, stdout: "piped", stderr: "piped" });
    const { code, stdout, stderr } = await p.output();
    const out = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    return { ok: code === 0, out };
  } catch (e) {
    return { ok: false, out: e instanceof Error ? e.message : String(e) };
  }
}

async function readLocalCommit(): Promise<string | null> {
  try { return (await Deno.readTextFile(join(APP_DIR, "VERSION"))).trim() || null; } catch { return null; }
}

async function fetchLatestCommit(): Promise<
  { ok: true; sha: string; date: string; message: string } | { ok: false; error: string }
> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`;
  try {
    const r = await fetch(url, {
      headers: { "Accept": "application/vnd.github+json", "User-Agent": "sub-manager" },
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, error: `GitHub ${r.status}: ${text.slice(0, 200)}` };
    const j = JSON.parse(text);
    return { ok: true, sha: String(j.sha ?? ""), date: String(j.commit?.author?.date ?? ""), message: String(j.commit?.message ?? "") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function handleVersion(_req: Request): Promise<Response> {
  const local = await readLocalCommit();
  const remote = await fetchLatestCommit();
  const remoteOk = remote.ok;
  return json({
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    local_commit: local,
    remote_commit: remoteOk ? remote.sha : null,
    remote_date: remoteOk ? remote.date : null,
    remote_message: remoteOk ? remote.message : null,
    remote_error: remoteOk ? null : remote.error,
    update_available: !!(local && remoteOk && remote.sha && !remote.sha.startsWith(local) && !local.startsWith(remote.sha)),
  });
}

export async function handleUpdateFromGithub(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!verifyAdminSession(req)) return json({ error: "unauthorized — admin login required" }, 401);
  if (UPDATE_TOKEN) {
    const t = req.headers.get("x-update-token") ?? "";
    if (t !== UPDATE_TOKEN) return json({ error: "bad token" }, 401);
  }

  const log: string[] = [];
  const push = (s: string) => { log.push(s); console.log("[gh-update]", s); };

  try {
    const remote = await fetchLatestCommit();
    if (!remote.ok) throw new Error(`GitHub: ${remote.error}`);
    push(`latest commit: ${remote.sha.slice(0, 7)} — ${remote.message.split("\n")[0]}`);

    const tmpRoot = await Deno.makeTempDir({ prefix: "sub-mgr-gh-" });
    const archivePath = join(tmpRoot, "src.tar.gz");
    const tarUrl = `https://codeload.github.com/${GITHUB_REPO}/tar.gz/${remote.sha}`;
    push(`downloading: ${tarUrl}`);
    const dl = await fetch(tarUrl);
    if (!dl.ok || !dl.body) throw new Error(`скачивание не удалось: HTTP ${dl.status}`);
    await Deno.writeFile(archivePath, new Uint8Array(await dl.arrayBuffer()));

    const extractDir = join(tmpRoot, "src");
    await Deno.mkdir(extractDir);
    const ext = await run(["tar", "-xzf", archivePath, "-C", extractDir]);
    push(`extract: ${ext.ok ? "ok" : "FAIL"}\n${ext.out}`);
    if (!ext.ok) throw new Error("extract failed");

    let srcDir = extractDir;
    const entries: Deno.DirEntry[] = [];
    for await (const e of Deno.readDir(extractDir)) entries.push(e);
    if (entries.length === 1 && entries[0].isDirectory) srcDir = join(extractDir, entries[0].name);
    push(`src dir: ${srcDir}`);

    try { await Deno.stat(join(srcDir, "package.json")); }
    catch { throw new Error("в архиве GitHub нет package.json"); }

    await backupData(push);

    const sync = await run([
      "rsync", "-a", "--delete",
      "--exclude", "data", "--exclude", "node_modules",
      "--exclude", ".git", "--exclude", "dist", "--exclude", ".env",
      `${srcDir.replace(/\/?$/, "/")}`,
      `${APP_DIR.replace(/\/?$/, "/")}`,
    ]);
    push(`rsync: ${sync.ok ? "ok" : "FAIL"}\n${sync.out}`);
    if (!sync.ok) throw new Error("rsync failed");

    const envCreated = await ensureEnv(req, url);
    push(envCreated ? ".env recreated" : ".env preserved");

    const inst = await run(["bun", "install", "--silent"], APP_DIR);
    push(`bun install: ${inst.ok ? "ok" : "FAIL"}\n${inst.out}`);
    if (!inst.ok) throw new Error("bun install failed");

    const build = await run(["bun", "run", "build"], APP_DIR);
    push(`bun run build: ${build.ok ? "ok" : "FAIL"}\n${build.out.slice(-2000)}`);
    if (!build.ok) throw new Error("build failed");

    await Deno.writeTextFile(join(APP_DIR, "VERSION"), remote.sha);
    push(`VERSION = ${remote.sha}`);

    try { await Deno.remove(tmpRoot, { recursive: true }); } catch {}

    push("restarting service…");
    queueMicrotask(async () => {
      await new Promise((r) => setTimeout(r, 500));
      await run(["systemctl", "restart", "sub-manager"]);
    });

    return json({ ok: true, commit: remote.sha, log: log.join("\n") });
  } catch (e) {
    push("ERROR: " + (e instanceof Error ? e.message : String(e)));
    return json({ ok: false, log: log.join("\n") }, 500);
  }
}

export async function handleUpdate(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  if (!verifyAdminSession(req)) return json({ error: "unauthorized — admin login required" }, 401);
  if (UPDATE_TOKEN) {
    const t = req.headers.get("x-update-token") ?? "";
    if (t !== UPDATE_TOKEN) return json({ error: "bad token" }, 401);
  }

  const log: string[] = [];
  const push = (s: string) => { log.push(s); console.log("[update]", s); };

  try {
    const form = await req.formData();
    const file = form.get("archive");
    if (!(file instanceof File)) return json({ error: "archive file required" }, 400);

    const lower = file.name.toLowerCase();
    const isZip = lower.endsWith(".zip");
    const isTgz = lower.endsWith(".tar.gz") || lower.endsWith(".tgz");
    if (!isZip && !isTgz) return json({ error: "только .zip или .tar.gz" }, 400);

    const tmpRoot = await Deno.makeTempDir({ prefix: "sub-mgr-upd-" });
    push(`temp dir: ${tmpRoot}`);

    const archivePath = join(tmpRoot, isZip ? "u.zip" : "u.tar.gz");
    await Deno.writeFile(archivePath, new Uint8Array(await file.arrayBuffer()));
    push(`saved archive (${file.size} bytes)`);

    const extractDir = join(tmpRoot, "src");
    await Deno.mkdir(extractDir);
    const ext = isZip
      ? await run(["unzip", "-q", archivePath, "-d", extractDir])
      : await run(["tar", "-xzf", archivePath, "-C", extractDir]);
    push(`extract: ${ext.ok ? "ok" : "FAIL"}\n${ext.out}`);
    if (!ext.ok) throw new Error("extract failed");

    // If archive contains a single top-level dir, descend into it.
    let srcDir = extractDir;
    const entries: Deno.DirEntry[] = [];
    for await (const e of Deno.readDir(extractDir)) entries.push(e);
    if (entries.length === 1 && entries[0].isDirectory) {
      srcDir = join(extractDir, entries[0].name);
    }
    push(`src dir: ${srcDir}`);

    // Sanity check — must look like our project.
    try { await Deno.stat(join(srcDir, "package.json")); }
    catch { throw new Error("в архиве нет package.json — это не похоже на проект"); }

    await backupData(push);

    // Sync into APP_DIR, preserving data/ and node_modules/.
    const sync = await run([
      "rsync", "-a", "--delete",
      "--exclude", "data",
      "--exclude", "node_modules",
      "--exclude", ".git",
      "--exclude", "dist",
      "--exclude", ".env",
      `${srcDir.replace(/\/?$/, "/")}`,
      `${APP_DIR.replace(/\/?$/, "/")}`,
    ]);
    push(`rsync: ${sync.ok ? "ok" : "FAIL"}\n${sync.out}`);
    if (!sync.ok) throw new Error("rsync failed");

    const envCreated = await ensureEnv(req, url);
    push(envCreated ? ".env was missing/broken — recreated" : ".env preserved");

    const inst = await run(["bun", "install", "--silent"], APP_DIR);
    push(`bun install: ${inst.ok ? "ok" : "FAIL"}\n${inst.out}`);
    if (!inst.ok) throw new Error("bun install failed");

    const build = await run(["bun", "run", "build"], APP_DIR);
    push(`bun run build: ${build.ok ? "ok" : "FAIL"}\n${build.out.slice(-2000)}`);
    if (!build.ok) throw new Error("build failed");

    // Cleanup temp.
    try { await Deno.remove(tmpRoot, { recursive: true }); } catch {}

    // Schedule restart in background so the response can return first.
    push("restarting service…");
    queueMicrotask(async () => {
      await new Promise((r) => setTimeout(r, 500));
      await run(["systemctl", "restart", "sub-manager"]);
    });

    return json({ ok: true, log: log.join("\n") });
  } catch (e) {
    push("ERROR: " + (e instanceof Error ? e.message : String(e)));
    return json({ ok: false, log: log.join("\n") }, 500);
  }
}