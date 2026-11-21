// Keyboard and mouse state: held keys, keys pressed this frame, mouse buttons and pointer-lock look.
// Scripted input (the screenshot autopilot) writes the same fields, so the game reads one source.

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight',
  'KeyF', 'KeyE', 'KeyR', 'KeyQ', 'KeyC', 'KeyH', 'KeyM', 'KeyN', 'KeyZ', 'Digit1', 'Digit2', 'Tab',
]);

export class Input {
  constructor(element) {
    this.element = element;
    this.held = new Set();
    this.pressed = new Set();
    this.mouseDown = [false, false, false];
    this.mouseClicked = [false, false, false];
    this.lookX = 0;
    this.lookY = 0;
    this.wheel = 0;
    this.enabled = true;
    this.locked = false;
    this.listen();
  }

  listen() {
    window.addEventListener('keydown', (event) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      if (!this.held.has(event.code)) this.pressed.add(event.code);
      this.held.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.held.delete(event.code));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.mouseDown = [false, false, false];
    });
    this.element.addEventListener('mousedown', (event) => {
      if (event.button > 2) return;
      this.mouseDown[event.button] = true;
      this.mouseClicked[event.button] = true;
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button <= 2) this.mouseDown[event.button] = false;
    });
    this.element.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.lookX += event.movementX;
      this.lookY += event.movementY;
    });
    window.addEventListener('wheel', (event) => {
      this.wheel += Math.sign(event.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
    });
  }

  requestLock() {
    if (!this.locked && this.element.requestPointerLock) {
      try {
        const result = this.element.requestPointerLock();
        if (result && result.catch) result.catch(() => {});
      } catch {
        // Pointer lock is a convenience; the game still plays with keys alone.
      }
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) {
    return this.enabled && this.held.has(code);
  }

  wasPressed(code) {
    return this.enabled && this.pressed.has(code);
  }

  /** -1..1 axes from WASD and the arrow keys. */
  axis() {
    const right = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const forward = (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0) - (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
    return { right, forward };
  }

  /** Mouse look since the last frame, consumed by the camera. */
  takeLook() {
    const look = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return look;
  }

  /** Clears the one-frame state at the end of each simulation step. */
  endStep() {
    this.pressed.clear();
    this.mouseClicked = [false, false, false];
    this.wheel = 0;
  }
}
