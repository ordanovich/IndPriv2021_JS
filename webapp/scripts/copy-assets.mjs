// Copies the static assets the viewer shares with the v1 app (province atlas
// images, logo, favicon) into public/. They are large and not tracked by git.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "terria_frontend", "wwwroot");
const dst = join(here, "..", "public");

const items = [
  ["atlas", "atlas"],
  ["images/logo.jpg", "images/logo.jpg"],
  ["favicon.ico", "favicon.ico"],
];
for (const [from, to] of items) {
  const a = join(src, from);
  if (!existsSync(a)) { console.warn("missing", a); continue; }
  mkdirSync(dirname(join(dst, to)), { recursive: true });
  cpSync(a, join(dst, to), { recursive: true });
  console.log("copied", from);
}
