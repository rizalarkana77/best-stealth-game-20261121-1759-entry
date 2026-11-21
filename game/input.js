// input.js — keyboard and mouse, nothing else. The game asks this object
// what the player is doing; it never touches the DOM events itself.

// Keys the game understands. WASD or arrows move; Shift sneaks; Space
// throws a pebble at the mouse; Enter starts or restarts; M mutes.
const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.sneakHeld = false;
    this.mouse = { x: 0, y: 0, inside: false };
    this.clicked = null; // {x, y} consumed once by the game loop
    this.pressed = new Set(); // keys pressed since last read, consumed once
    this.attach();
  }

  attach() {
    window.addEventListener('keydown', (event) => {
      if (MOVE_KEYS[event.code]) {
        this.held.add(MOVE_KEYS[event.code]);
        event.preventDefault();
      }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        this.sneakHeld = true;
      }
      if (event.code === 'Space') event.preventDefault();
      this.pressed.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      if (MOVE_KEYS[event.code]) this.held.delete(MOVE_KEYS[event.code]);
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        this.sneakHeld = false;
      }
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.sneakHeld = false;
    });
    this.canvas.addEventListener('mousemove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
      this.mouse.inside = true;
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.mouse.inside = false;
    });
    this.canvas.addEventListener('mousedown', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.clicked = {
        x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
        y: (event.clientY - rect.top) * (this.canvas.height / rect.height),
      };
    });
  }

  // The movement direction right now, normalised, or null when still.
  moveDirection() {
    let x = 0;
    let y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y -= 1;
    if (this.held.has('down')) y += 1;
    if (x === 0 && y === 0) return null;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  // Take the pending click (if any) so it is handled exactly once.
  takeClick() {
    const click = this.clicked;
    this.clicked = null;
    return click;
  }

  // Was this key pressed since the last frame? Consumed on read.
  wasPressed(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  // Drop stale presses (used when the state changes, e.g. title -> play).
  clearPressed() {
    this.pressed.clear();
    this.clicked = null;
  }
}
