// Emberwick Vault — the hand-in program (Node 22, standard library only).
// It gathers what the grader needs into /output: the whole game/ folder,
// the screenshots/ folder, and a dossier.json written by make.fun's own
// library, so the judge reads exactly the game that was built here.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Refuse to hand in an empty game: the dossier would describe nothing.
const gameFiles = readdirSync(join(repoRoot, 'game'));
if (gameFiles.length === 0) throw new Error('game/ is empty — nothing to hand in');
const shotFiles = existsSync(join(repoRoot, 'screenshots'))
  ? readdirSync(join(repoRoot, 'screenshots')).filter((f) => !f.startsWith('.'))
  : [];
if (shotFiles.length < 3) throw new Error(`need 3 or 4 screenshots, found ${shotFiles.length}`);

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own: four screenshots at most, each within
// 256 KiB; game/ within 993 files and 48 MiB; paths within 1000 bytes.
// The program is deterministic: two runs write the same bytes, which the
// grader checks by running it twice.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(
  `handed in ${gameFiles.length} game entries, ${shotFiles.length} screenshots, `
  + `dossier ${dossier.length} bytes -> ${outDir}`,
);
