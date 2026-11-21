// Takes Port Solara's screenshots (Node 22, standard library only): serves game/ with serve.ts, opens
// each scene listed in shots.json in headless Microsoft Edge (software WebGL so it works anywhere),
// and converts each capture with ffmpeg to a 1280x720 JPEG of at most 256 KiB in screenshots/.
//
//   node shoot.ts            all scenes
//   node shoot.ts chase      only scenes whose query mentions "chase"
//
// EDGE and FFMPEG environment variables override the executables' locations.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const edge = process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const port = 8093;
const limit = 256 * 1024;
const shots: { name: string; query: string }[] = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const only = process.argv[2];

const server = spawn(process.execPath, [join(here, 'serve.ts'), '--port', String(port)], { stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 800));

const work = join(tmpdir(), `port-solara-shots-${process.pid}`);
mkdirSync(work, { recursive: true });
mkdirSync(join(here, 'screenshots'), { recursive: true });

try {
  for (const shot of shots) {
    if (only && !shot.query.includes(only)) continue;
    const png = join(work, shot.name.replace(/\.\w+$/, '.png'));
    const profile = join(work, `profile-${shot.name}`);
    const started = Date.now();
    const result = spawnSync(edge, [
      '--headless=new',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      '--window-size=1280,720',
      '--virtual-time-budget=60000',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${png}`,
      `http://127.0.0.1:${port}/index.html${shot.query}`,
    ], { stdio: 'pipe', timeout: 240000 });
    if (result.error) throw result.error;
    const out = join(here, 'screenshots', shot.name);
    let quality = 3;
    for (;;) {
      spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=1280:720:flags=lanczos', '-q:v', String(quality), out], { stdio: 'inherit' });
      const size = statSync(out).size;
      if (size <= limit || quality >= 15) {
        console.log(`${shot.name}: ${(size / 1024).toFixed(0)} KiB at q${quality}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
        break;
      }
      quality += 1;
    }
  }
} finally {
  server.kill();
  rmSync(work, { recursive: true, force: true });
}
