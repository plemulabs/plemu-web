import { readFile, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(root, "public");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function asset(path) {
  const file = resolve(publicRoot, path.replace(/^\//, ""));
  if (!file.startsWith(publicRoot + sep) || !(await lstat(file)).isFile())
    throw new Error(`Invalid public asset: ${path}`);
  return readFile(file);
}
const catalog = JSON.parse(
  await readFile(resolve(root, "lib/browser-catalog.json"), "utf8"),
);
const publicCatalog = JSON.parse(await asset("/seeker/catalog.json"));
if (JSON.stringify(catalog) !== JSON.stringify(publicCatalog))
  throw new Error("Public and application catalogs differ");
for (const game of catalog.games) {
  const bytes = await asset(game.rom);
  if (bytes.byteLength !== game.size || digest(bytes) !== game.sha256)
    throw new Error(`Game artifact mismatch: ${game.id}`);
  await asset(game.cover);
  await asset(game.evidence);
}
let runtimeFiles = 0;
for (const runtime of ["emulator", "emulator-snes"]) {
  const manifest = JSON.parse(await asset(`/${runtime}/manifest.json`));
  for (const [path, hash] of Object.entries(manifest.files)) {
    if (digest(await asset(`/${runtime}/${path}`)) !== hash)
      throw new Error(`Runtime artifact mismatch: ${runtime}/${path}`);
    runtimeFiles++;
  }
}
console.log(
  `Verified ${catalog.games.length} catalog games and ${runtimeFiles} runtime files. Corresponding-source/license release gates remain unchanged.`,
);
