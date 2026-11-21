// The title screen (Continue / New Game / Controls over a slow aerial tour of the city), the pause
// menu (resume, save, load, controls, sound, quit) with a summary of progress, and the controls card.
import { formatCash } from '../core/mathUtils.js';
import { SUN_TOKEN_COUNT } from '../progression/progress.js';
import { MISSIONS } from '../missions/storyScript.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(game) {
    this.game = game;
    this.screens = { title: $('title-screen'), pause: $('pause-screen'), controls: $('controls-screen'), loading: $('loading') };
    this.controlsReturn = 'title';
    for (const button of document.querySelectorAll('.menu button')) {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        game.audio.unlock();
        game.events.emit('ui:click', {});
        this.handle(button.dataset.action);
      });
    }
  }

  showOnly(name) {
    for (const [key, node] of Object.entries(this.screens)) node.classList.toggle('hidden', key !== name);
  }

  showTitle() {
    $('continue-button').classList.toggle('hidden', !this.game.saves.hasSave());
    this.showOnly('title');
  }

  showPause() {
    const game = this.game;
    const progress = game.progress;
    const done = game.missions.completed;
    $('pause-stats').innerHTML = [
      `Story: ${done} of ${MISSIONS.length} jobs done${game.missions.active ? ` · on "${game.missions.active.mission.title}"` : ''}`,
      `Cash ${formatCash(progress.cash)} · Sun Tokens ${progress.tokens.size}/${SUN_TOKEN_COUNT}`,
      `Cars taken ${progress.stats.carsStolen} · Police shaken off ${progress.stats.copsEvaded} · ${(progress.stats.distance / 1000).toFixed(1)} km travelled`,
    ].join('<br>');
    $('audio-button').textContent = `Sound: ${game.audio.enabled ? 'On' : 'Off'}`;
    this.showOnly('pause');
  }

  hideAll() {
    this.showOnly(null);
  }

  handle(action) {
    const game = this.game;
    switch (action) {
      case 'new':
        game.newGame();
        break;
      case 'continue':
        if (game.saves.load()) game.resume();
        break;
      case 'controls':
        this.controlsReturn = game.state === 'paused' ? 'pause' : 'title';
        this.showOnly('controls');
        break;
      case 'back':
        if (this.controlsReturn === 'pause') this.showPause();
        else this.showTitle();
        break;
      case 'resume':
        game.resume();
        break;
      case 'save':
        game.saves.save();
        game.notify.toast('Game saved.');
        game.resume();
        break;
      case 'load':
        if (game.saves.load()) {
          game.notify.toast('Game loaded.');
          game.resume();
        } else {
          game.notify.toast('No saved game yet.');
          game.resume();
        }
        break;
      case 'audio':
        game.audio.setEnabled(!game.audio.enabled);
        $('audio-button').textContent = `Sound: ${game.audio.enabled ? 'On' : 'Off'}`;
        break;
      case 'quit':
        game.toTitle();
        break;
      default:
        break;
    }
  }
}
