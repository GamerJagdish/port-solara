// A tiny publish/subscribe bus so systems (crimes, missions, audio, HUD) can react to each other
// without importing each other.

export class EventBus {
  constructor() {
    this.handlers = new Map();
  }
  on(name, handler) {
    if (!this.handlers.has(name)) this.handlers.set(name, []);
    this.handlers.get(name).push(handler);
    return () => this.off(name, handler);
  }
  off(name, handler) {
    const list = this.handlers.get(name);
    if (list) this.handlers.set(name, list.filter((h) => h !== handler));
  }
  emit(name, payload) {
    const list = this.handlers.get(name);
    if (!list) return;
    for (const handler of list.slice()) handler(payload);
  }
}
