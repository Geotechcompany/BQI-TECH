const fs = require("fs");
const path = require("path");

/**
 * One-shot UI path migrator: quoted `/admin` → `/manage`.
 *
 * CRITICAL: Backend API mounts stay at `/api/admin` forever.
 * This script must NEVER rewrite `/api/admin` to `/api/manage`.
 */
const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
]);
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(ent.name))) out.push(full);
  }
  return out;
}

function transform(content, rel) {
  // Already hand-maintained for the new path model
  if (rel === "lib/admin-path.ts" || rel === "middleware.ts") {
    return null;
  }
  // Backend API routes stay under /api/admin
  if (rel.startsWith("Backend/")) return null;

  // Freeze every `/api/admin` occurrence so UI `/admin` → `/manage` replaces
  // cannot touch API mounts (e.g. `"/api/admin/..."` must stay intact).
  const placeholders = [];
  let s = content.replace(/\/api\/admin/g, (m) => {
    const key = `__API_ADMIN_${placeholders.length}__`;
    placeholders.push(m);
    return key;
  });

  s = s.replace(/(['"`])\/admin\//g, "$1/manage/");
  s = s.replace(/(['"`])\/admin(['"`])/g, "$1/manage$2");

  placeholders.forEach((val, i) => {
    s = s.split(`__API_ADMIN_${i}__`).join(val);
  });

  // Hard guards: never emit or destroy API admin prefixes.
  if (/\/api\/manage\b/.test(s)) {
    throw new Error(
      `${rel}: refuse to write — transform would introduce /api/manage (API must stay /api/admin)`
    );
  }
  const beforeCount = (content.match(/\/api\/admin/g) || []).length;
  const afterCount = (s.match(/\/api\/admin/g) || []).length;
  if (afterCount < beforeCount) {
    throw new Error(
      `${rel}: refuse to write — /api/admin count dropped (${beforeCount} → ${afterCount})`
    );
  }

  return s === content ? null : s;
}

const files = walk(ROOT);
let changed = 0;
const list = [];
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const raw = fs.readFileSync(f, "utf8");
  const next = transform(raw, rel);
  if (next != null) {
    fs.writeFileSync(f, next);
    changed++;
    list.push(rel);
  }
}
console.log(`Updated ${changed} files`);
console.log(list.join("\n"));
