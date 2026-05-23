import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const APP_DIR = Deno.env.get("APP_DIR") ?? "/opt/sub-manager";
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") ?? "u1133150947-cyber/my-sub-spark-9db9c9f2";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";

type State = "queued" | "running" | "done" | "error";

const mode = Deno.args[0] ?? "";
const jobId = Deno.args[1] ?? "";
const payload = Deno.args[2] ?? "";
const statusPath = join(APP_DIR, ".updates", `${jobId}.json`);
const log: string[] = [];

function ghHeaders(extra: Record<string, string> = {}): HeadersInit {
  const h: Record<string, string> = { "User-Agent": "sub-manager", ...extra };
  if (GITHUB_TOKEN) h["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function save(state: State, phase: string, extra: Record<string, unknown> = {}) {
  await Deno.writeTextFile(statusPath, JSON.stringify({
    job_id: jobId,
    state,
    phase,
    log: log.join("\n"),
    updated_at: new Date().toISOString(),
    ...extra,
  }, null, 2));
}

async function push(s: string, phase = "running") {
  log.push(s);
  console.log(`[update-worker:${jobId}]`, s);
  await save("running", phase);
}

async function run(cmd: string[], cwd?: string): Promise<{ ok: boolean; out: string }> {
  try {
    const wrapped = ["nice", "-n", "15", "ionice", "-c", "3", ...cmd];
    const p = new Deno.Command(wrapped[0], { args: wrapped.slice(1), cwd, stdout: "piped", stderr: "piped" });
    const { code, stdout, stderr } = await p.output();
    const out = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    return { ok: code === 0, out };
  } catch (e) {
    return { ok: false, out: e instanceof Error ? e.message : String(e) };
  }
}

async function backupData() {
  const dataDir = join(APP_DIR, "data");
  try { await Deno.stat(dataDir); } catch { await push("data/ not found — skipping backup", "backup"); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupsDir = join(APP_DIR, "backups");
  await Deno.mkdir(backupsDir, { recursive: true });
  const dest = join(backupsDir, `data-${stamp}.tar.gz`);
  const r = await run(["tar", "-czf", dest, "-C", APP_DIR, "data"]);
  if (!r.ok) throw new Error(`backup failed: ${r.out}`);
  await push(`💾 backup: ${dest}`, "backup");
}

async function extractArchive(archivePath: string): Promise<string> {
  const extractDir = await Deno.makeTempDir({ prefix: "sub-mgr-work-" });
  const lower = archivePath.toLowerCase();
  const ext = lower.endsWith(".zip")
    ? await run(["unzip", "-q", archivePath, "-d", extractDir])
    : await run(["tar", "-xzf", archivePath, "-C", extractDir]);
  await push(`extract: ${ext.ok ? "ok" : "FAIL"}\n${ext.out}`, "extract");
  if (!ext.ok) throw new Error("extract failed");

  let srcDir = extractDir;
  const entries: Deno.DirEntry[] = [];
  for await (const e of Deno.readDir(extractDir)) entries.push(e);
  if (entries.length === 1 && entries[0].isDirectory) srcDir = join(extractDir, entries[0].name);
  try { await Deno.stat(join(srcDir, "package.json")); }
  catch { throw new Error("в архиве нет package.json — это не похоже на проект"); }
  await push(`src dir: ${srcDir}`, "extract");
  return srcDir;
}

async function downloadGithubArchive(sha: string): Promise<string> {
  const archivePath = join(await Deno.makeTempDir({ prefix: "sub-mgr-gh-" }), "src.tar.gz");
  const tarUrl = GITHUB_TOKEN
    ? `https://api.github.com/repos/${GITHUB_REPO}/tarball/${sha}`
    : `https://codeload.github.com/${GITHUB_REPO}/tar.gz/${sha}`;
  await push(`downloading: ${tarUrl}`, "download");
  const dl = await fetch(tarUrl, { headers: ghHeaders({ "Accept": "application/vnd.github+json" }), redirect: "follow" });
  if (!dl.ok || !dl.body) throw new Error(`скачивание не удалось: HTTP ${dl.status}`);
  await Deno.writeFile(archivePath, new Uint8Array(await dl.arrayBuffer()));
  return archivePath;
}

async function applyUpdate(srcDir: string, sha?: string) {
  await backupData();

  const sync = await run([
    "rsync", "-a", "--delete",
    "--exclude", "data", "--exclude", "node_modules",
    "--exclude", ".git", "--exclude", ".env",
    `${srcDir.replace(/\/?$/, "/")}`,
    `${APP_DIR.replace(/\/?$/, "/")}`,
  ]);
  await push(`rsync: ${sync.ok ? "ok" : "FAIL"}\n${sync.out}`, "sync");
  if (!sync.ok) throw new Error("rsync failed");

  try { await Deno.stat(join(APP_DIR, "dist", "index.html")); }
  catch {
    await push("dist/ не найден — запускаю лёгкую фоновую сборку", "build");
    const inst = await run(["bun", "install", "--silent"], APP_DIR);
    await push(`bun install: ${inst.ok ? "ok" : "FAIL"}\n${inst.out}`, "build");
    if (!inst.ok) throw new Error("bun install failed");
    const build = await run(["bun", "run", "build"], APP_DIR);
    await push(`bun run build: ${build.ok ? "ok" : "FAIL"}\n${build.out.slice(-2000)}`, "build");
    if (!build.ok) throw new Error("build failed");
  }

  if (sha) await Deno.writeTextFile(join(APP_DIR, "VERSION"), sha);
  await push("restarting service…", "restart");
  await run(["systemctl", "restart", "sub-manager"]);
}

try {
  await save("running", "start");
  const archivePath = mode === "github" ? await downloadGithubArchive(payload) : payload;
  const srcDir = await extractArchive(archivePath);
  await applyUpdate(srcDir, mode === "github" ? payload : undefined);
  await save("done", "done");
} catch (e) {
  log.push("ERROR: " + (e instanceof Error ? e.message : String(e)));
  await save("error", "error");
}