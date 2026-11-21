// Boots Port Solara: reads the URL (?seed=, and ?shot= for the deterministic screenshot scenes),
// builds the game, and opens the title screen or stages the requested scene.
import { Game } from './game.js';
import { stageShot } from './shots/screenshotScenes.js';

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;
const shot = params.get('shot');

function boot() {
  const game = new Game(document.getElementById('view'), { seed, shot });
  window.portSolara = game;
  document.getElementById('loading').classList.add('hidden');
  if (shot) {
    stageShot(game, shot);
    game.render();
    game.renderer.setAnimationLoop(() => game.render());
    document.title = `Port Solara · ${shot} ready`;
    window.__shotReady = true;
    return;
  }
  game.toTitle();
  game.start();
  // Browsers only allow sound after a gesture: the first click or key starts the title theme.
  const wake = () => {
    game.audio.unlock();
    if (game.state === 'title') game.radio.play(2);
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
  };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
}

// Screenshot scenes build at once; play lets the loading screen paint before the city is built.
if (shot) boot();
else setTimeout(boot, 50);
