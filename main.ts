// Solara Bay — entrypoint. It copies game/ and screenshots/ from this
// repository into the output directory and writes dossier.json there with
// buildDossier from the kit's vendor/makefun-game.ts.
//
// Run it locally with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader it writes to /output instead. Node 22, standard library only.

import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// Guard: the competition needs 3 or 4 screenshots, the first by name the
// cover. Warn loudly instead of handing in a short set by accident.
const shotCount = readdirSync(join(outDir, 'screenshots')).filter((n) => !n.startsWith('.')).length;
if (shotCount < 3) {
  console.warn(`solara-bay: WARNING — only ${shotCount} screenshot(s) in screenshots/; the competition needs 3 or 4`);
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`solara-bay: game/ + screenshots/ + dossier.json (${dossier.length} bytes) -> ${outDir}`);
