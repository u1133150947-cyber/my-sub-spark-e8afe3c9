// Self-update endpoint: receive an archive (.zip or .tar.gz) and apply it in-place.
// Protected by Caddy basic-auth in front; we additionally require an env-set token if provided.
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { verifyAdminSession } from "./auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token, x-update-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const APP_DIR = Deno.env.get("APP_DIR") ?? "/opt/sub-manager";
const UPDATE_TOKEN = Deno.env.get("UPDATE_TOKEN") ?? ""; // optional extra check
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") ?? "u1133150947-cyber/my-sub-spark-9db9c9f2";
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") ?? "main";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? ""; // нужен для приватных репозиториев

function ghHeaders(extra: Record<string, string> = {}): HeadersInit {
  const h: Record<string, string> = {
    "User-Agent": "sub-manager",
    ...extra,
  };
  if (GITHUB_TOKEN) h["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  return h;
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
      headers: ghHeaders({ "Accept": "application/vnd.github+json" }),
    });
    const text = await r.text();
    if (!r.ok) {
      const hint = r.status === 404 && !GITHUB_TOKEN
        ? " — репозиторий приватный? Задай GITHUB_TOKEN в /etc/sub-manager.env (Personal Access Token с правом repo:read) и перезапусти sub-manager."
        : "";
      return { ok: false, error: `GitHub ${r.status}: ${text.slice(0, 200)}${hint}` };
    }
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

async function updateDir(): Promise<string> {
  const dir = join(APP_DIR, ".updates");
  await Deno.mkdir(dir, { recursive: true });
  return dir;
}

function jobStatusPath(jobId: string): string | null {
  if (!/^[a-f0-9-]{36}$/i.test(jobId)) return null;
  return join(APP_DIR, ".updates", `${jobId}.json`);
}

async function writeJobStatus(jobId: string, data: Record<string, unknown>) {
  const dir = await updateDir();
  await Deno.writeTextFile(join(dir, `${jobId}.json`), JSON.stringify({
    job_id: jobId,
    state: "queued",
    phase: "queued",
    log: "⏳ Обновление поставлено в очередь…\n",
    started_at: new Date().toISOString(),
    ...data,
  }, null, 2));
}

async function startWorker(args: string[], jobId: string): Promise<Response> {
  await writeJobStatus(jobId, {});
  const child = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", join(APP_DIR, "server/update-worker.ts"), ...args],
    cwd: APP_DIR,
    stdin: "null",
    stdout: "null",
    stderr: "null",
  }).spawn();
  (child as { unref?: () => void }).unref?.();
  return json({
    ok: true,
    accepted: true,
    job_id: jobId,
    status_url: `/api/update/status?job=${jobId}`,
    log: "Обновление запущено в фоне. Панель не будет ждать сборку в HTTP-запросе.",
  }, 202);
}

export async function handleUpdateStatus(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!verifyAdminSession(req)) return json({ error: "unauthorized — admin login required" }, 401);

  const job = url.searchParams.get("job") ?? "";
  if (!job) return json({ error: "job required" }, 400);
  const statusPath = jobStatusPath(job);
  if (!statusPath) return json({ error: "bad job" }, 400);

  try {
    return new Response(await Deno.readTextFile(statusPath), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch {
    return json({ error: "job not found" }, 404);
  }
}

export async function handleUpdateFromGithub(req: Request, _url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!verifyAdminSession(req)) return json({ error: "unauthorized — admin login required" }, 401);
  if (UPDATE_TOKEN) {
    const t = req.headers.get("x-update-token") ?? "";
    if (t !== UPDATE_TOKEN) return json({ error: "bad token" }, 401);
  }

  const remote = await fetchLatestCommit();
  if (!remote.ok) return json({ ok: false, log: `GitHub: ${remote.error}` }, 500);

  const jobId = crypto.randomUUID();
  return await startWorker(["github", jobId, remote.sha], jobId);
}

export async function handleUpdate(req: Request, _url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  if (!verifyAdminSession(req)) return json({ error: "unauthorized — admin login required" }, 401);
  if (UPDATE_TOKEN) {
    const t = req.headers.get("x-update-token") ?? "";
    if (t !== UPDATE_TOKEN) return json({ error: "bad token" }, 401);
  }

  try {
    const form = await req.formData();
    const file = form.get("archive");
    if (!(file instanceof File)) return json({ error: "archive file required" }, 400);

    const lower = file.name.toLowerCase();
    const isZip = lower.endsWith(".zip");
    const isTgz = lower.endsWith(".tar.gz") || lower.endsWith(".tgz");
    if (!isZip && !isTgz) return json({ error: "только .zip или .tar.gz" }, 400);

    const jobId = crypto.randomUUID();
    const dir = await updateDir();
    const archivePath = join(dir, `${jobId}${isZip ? ".zip" : ".tar.gz"}`);
    await Deno.writeFile(archivePath, new Uint8Array(await file.arrayBuffer()));
    return await startWorker(["archive", jobId, archivePath], jobId);
  } catch (e) {
    return json({ ok: false, log: "ERROR: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
}