import { cp, mkdir, rm } from "node:fs/promises";
import { build as bundle } from "esbuild";
import { fileURLToPath } from "node:url";

await rm(new URL("../dist/", import.meta.url), { recursive: true, force: true });
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await cp(new URL("../web/", import.meta.url), new URL("../dist/", import.meta.url), { recursive: true });
await mkdir(new URL("../work/function-package/", import.meta.url), { recursive: true });
await bundle({
  entryPoints: [fileURLToPath(new URL("../netlify/functions/game.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["@netlify/blobs"],
  outfile: fileURLToPath(new URL("../work/function-package/game.mjs", import.meta.url)),
});
console.log("Built frontend into dist/ and verified the bundled Netlify function.");
