// Normalize client logos for the login page into uniform monochrome silhouettes.
//
// The source logos are a heterogeneous mix: aspect ratios span 1:1 to ~14:1,
// native heights span 24px to 500px, two have baked-in dark backgrounds
// (light-ink-on-dark designs), and the rest are multi-color transparent PNGs.
// A fixed CSS box can't make that uniform, so we normalize the *assets*:
//   1. flood-fill the baked dark background to transparent (the two boxed logos)
//   2. trim whitespace so each logo's bounding box == its ink
//   3. recolor everything to ONE neutral ink, preserving alpha -> mono silhouette
//
// Output lands in clients/normalized/ for review, then gets promoted into
// clients/ once it looks right. Re-runnable; requires ImageMagick 7 (`magick`).
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const INK = "#475569"; // slate-600 — single ink color for every logo
const FUZZ = "25%"; // background flood-fill tolerance

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "frontend", "public", "clients");
const OUT = join(SRC, "normalized");

// Per-logo colors to flood-fill to transparent BEFORE silhouetting. Needed for
// logos whose shape isn't already the alpha channel:
//  - dark-background lockups (light ink baked on a solid dark field)
//  - solid badges where the inner mark is an opaque light fill, not a cutout
//    (e.g. lululemon's white omega) — knocking the fill out restores the mark.
const TRANSPARENT = {
  pastabasta: ["srgb(0,73,43)"], // dark green background
  boutiquecentral: ["srgb(1,42,94)"], // navy background
  lululemon: ["white"], // white omega -> negative space inside the disc
};

mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => /\.(png|jpe?g)$/i.test(f));
for (const f of files) {
  const slug = basename(f, extname(f));
  const out = join(OUT, `${slug}.png`);
  const args = [join(SRC, f)];
  for (const color of TRANSPARENT[slug] ?? []) {
    args.push("-fuzz", FUZZ, "-transparent", color);
  }
  args.push("-trim", "+repage", "-fill", INK, "-colorize", "100", out);
  execFileSync("magick", args, { stdio: "pipe" });
  console.log(`✓ ${f} -> normalized/${slug}.png`);
}
console.log(`\nDone. ${files.length} logos normalized into ${OUT}`);
