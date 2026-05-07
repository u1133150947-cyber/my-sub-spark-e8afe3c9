// Self-update endpoint: receive an archive (.zip or .tar.gz) and apply it in-place.
// Protected by Caddy basic-auth in front; we additionally require an env-set token if provided.
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const APP_DIR = Deno.env.get("APP_DIR") ?? "/opt/sub-manager";
const UPDATE_TOKEN = Deno.env.get("UPDATE_TOKEN") ?? ""; // optional extra check

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

export async function handleUpdate(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

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