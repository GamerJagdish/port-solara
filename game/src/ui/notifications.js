// Text the game shows the player: spoken dialogue as subtitles (queued line by line), phone calls,
// short toasts, the big MISSION PASSED / FAILED banners, the objective box and the context prompt.
// It runs on game time so screenshot scenes freeze it exactly.

const $ = (id) => document.getElementById(id);

export class Notifications {
  constructor(game) {
    this.game = game;
    this.lines = [];
    this.lineTime = 0;
    this.bannerTime = 0;
    this.toasts = [];
    this.lastObjective = '';
    this.el = {
      subtitle: $('subtitle'),
      banner: $('banner'),
      bannerTitle: $('banner-title'),
      bannerSub: $('banner-sub'),
      toastStack: $('toast-stack'),
      objectiveBox: $('objective-box'),
      missionTitle: $('mission-title'),
      objectiveText: $('objective-text'),
      timer: $('objective-timer'),
      prompt: $('prompt'),
    };
  }

  get dialogueActive() {
    return this.lines.length > 0;
  }

  /** Queues lines of [speaker, text, seconds]. */
  dialogue(lines, { phone = false } = {}) {
    for (const [speaker, text, seconds] of lines) this.lines.push({ speaker, text, seconds, phone });
    if (this.lines.length === lines.length) this.showLine();
  }

  skipLine() {
    if (!this.lines.length) return;
    this.lines.shift();
    this.showLine();
  }

  showLine() {
    const line = this.lines[0];
    if (!line) {
      this.el.subtitle.classList.add('hidden');
      return;
    }
    this.lineTime = line.seconds;
    this.el.subtitle.innerHTML = `<b>${line.phone ? '📞 ' : ''}${escapeHtml(line.speaker)}:</b> ${escapeHtml(line.text)}`;
    this.el.subtitle.classList.remove('hidden');
  }

  toast(text, seconds = 4) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = text;
    this.el.toastStack.appendChild(node);
    this.toasts.push({ node, time: seconds });
    while (this.toasts.length > 4) this.toasts.shift().node.remove();
  }

  banner(title, subtitle = '', seconds = 3, bad = false) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = subtitle === 'mission' ? '' : subtitle;
    this.el.banner.classList.toggle('bad', bad);
    this.el.banner.classList.remove('hidden');
    this.bannerTime = seconds;
  }

  /** Shows (or hides, with null) the objective box. */
  objective(view) {
    if (!view || !view.text) {
      this.el.objectiveBox.classList.add('hidden');
      return;
    }
    this.el.objectiveBox.classList.remove('hidden');
    this.el.missionTitle.textContent = view.title ?? '';
    if (view.text !== this.lastObjective) {
      this.el.objectiveText.textContent = view.text;
      this.lastObjective = view.text;
    }
    const timer = view.timer;
    if (timer !== null && timer !== undefined) {
      this.el.timer.classList.remove('hidden');
      const m = Math.floor(timer / 60);
      const s = Math.floor(timer % 60);
      this.el.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
      this.el.timer.style.color = timer < 20 ? '#ff5d73' : '#fff';
    } else if (view.health !== null && view.health !== undefined) {
      this.el.timer.classList.remove('hidden');
      this.el.timer.innerHTML = `<span style="font-size:13px;letter-spacing:1px">TARGET</span> <span style="display:inline-block;width:150px;height:10px;background:rgba(0,0,0,.5);border:2px solid #fff;vertical-align:middle"><span style="display:block;height:100%;width:${Math.round(view.health * 100)}%;background:#ff5d73"></span></span>`;
    } else {
      this.el.timer.classList.add('hidden');
    }
  }

  /** The "press a key" hint at the top of the screen; html may contain <kbd>. */
  prompt(html) {
    if (!html) {
      this.el.prompt.classList.add('hidden');
      return;
    }
    if (this.el.prompt.innerHTML !== html) this.el.prompt.innerHTML = html;
    this.el.prompt.classList.remove('hidden');
  }

  update(dt) {
    if (this.lines.length) {
      this.lineTime -= dt;
      if (this.lineTime <= 0) {
        this.lines.shift();
        this.showLine();
      }
    }
    if (this.bannerTime > 0) {
      this.bannerTime -= dt;
      if (this.bannerTime <= 0) this.el.banner.classList.add('hidden');
    }
    for (const toast of this.toasts) toast.time -= dt;
    while (this.toasts.length && this.toasts[0].time <= 0) this.toasts.shift().node.remove();
  }

  clear() {
    this.lines = [];
    this.showLine();
    this.bannerTime = 0;
    this.el.banner.classList.add('hidden');
    for (const toast of this.toasts) toast.node.remove();
    this.toasts = [];
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
