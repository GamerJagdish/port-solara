// Hands Port Solara in to make.fun (Node 22, standard library only). The game is game/: static files
// a desktop browser plays offline (index.html, style.css, the ES modules under src/ and three.js
// vendored as one minified file under vendor/). This program copies game/ and screenshots/ to the
// output directory and writes dossier.json, the summary the judge reads, with the kit's library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output. Play locally with `node serve.ts`;
// retake the screenshots with `node shoot.ts`.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repository = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Replaces `name` in the output with a fresh copy from the repository, so every run writes the same bytes. */
function copyFresh(name: string): void {
  const target = join(output, name);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const source = join(repository, name);
  if (existsSync(source)) cpSync(source, target, { recursive: true });
}

mkdirSync(output, { recursive: true });
copyFresh('game');
copyFresh('screenshots');

// The scorer's caps: the dossier text is cut at 160 KiB, at most 4 screenshots of 256 KiB each, and game/
// stays within 993 entries, 48 MiB and 1000-byte paths (it shares /output's 1000-entry cap).
const dossier = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(output, 'dossier.json'), dossier);
