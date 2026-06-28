import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = import.meta.dirname;
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "icons"), { recursive: true });

await Promise.all([
  cp(resolve(root, "static/manifest.json"), resolve(dist, "manifest.json")),
  cp(resolve(root, "static/popup.html"), resolve(dist, "popup.html")),
  cp(resolve(root, "static/popup.css"), resolve(dist, "popup.css")),
  cp(resolve(root, "static/icons"), resolve(dist, "icons"), { recursive: true }),
]);

await build({
  entryPoints: {
    background: resolve(root, "src/background.ts"),
    content: resolve(root, "src/content.ts"),
    popup: resolve(root, "src/popup.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  sourcemap: true,
  minify: false,
  logLevel: "info",
});
