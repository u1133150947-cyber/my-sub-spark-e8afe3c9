import { existsSync, cpSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (existsSync("dist/index.html")) {
  console.log("dist already exists — skipping vite build");
  process.exit(0);
}

if (existsSync("public/index.html")) {
  cpSync("public", "dist", { recursive: true });
  console.log("copied public/ to dist/");
  process.exit(0);
}

const r = spawnSync("vite", ["build"], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);