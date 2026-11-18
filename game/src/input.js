// Neon Harbor — keyboard + mouse input (fresh code for round 3).
export const keys = Object.create(null);
export const mouse = { x: 0, y: 0, down: false, worldX: 0, worldY: 0 };
export const pressed = Object.create(null); // edge-triggered, consumed by game

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyE: 'enter',
  KeyR: 'reload',
  KeyQ: 'phone',
  KeyM: 'phone',
  KeyC: 'continue',
  Space: 'shoot',
  Enter: 'confirm',
  Escape: 'close',
};

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const name = KEYMAP[e.code];
    if (name) {
      if (!keys[name]) pressed[name] = true;
      keys[name] = true;
      if (name === 'shoot' || name === 'up' || name === 'down' || name === 'confirm') e.preventDefault();
    }
    if (e.code.startsWith('Digit')) pressed['digit' + e.code.slice(5)] = true;
  });
  window.addEventListener('keyup', (e) => {
    const name = KEYMAP[e.code];
    if (name) keys[name] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; pressed.shoot = true; }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    mouse.down = false;
  });
}

export function consume(name) {
  if (pressed[name]) { pressed[name] = false; return true; }
  return false;
}

export function endFrame() {
  for (const k of Object.keys(pressed)) pressed[k] = false;
}
