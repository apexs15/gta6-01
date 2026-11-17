// Solara Bay — keyboard and mouse input. Keys are tracked by code so the
// layout does not depend on the player's keyboard language.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDown = false;
    this.mouseClicked = false;
    this.cameraOrbit = 0;
    this.canvas = canvas;
    this.onKey = null;
    this.onShoot = null;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'ArrowLeft') this.cameraOrbit += 0.35;
      if (e.code === 'ArrowRight') this.cameraOrbit -= 0.35;
      if (this.onKey) this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
        if (this.onShoot) this.onShoot();
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) {
    return this.keys.has(code);
  }

  // Camera orbit nudges since the last frame (arrow keys), consumed once.
  takeOrbit() {
    const o = this.cameraOrbit;
    this.cameraOrbit = 0;
    return o;
  }

  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  moveVector() {
    let x = 0;
    let z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z += 1;
    if (this.down('KeyA')) x -= 1;
    if (this.down('KeyD')) x += 1;
    return { x, z };
  }

  get run() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  get interactHeld() {
    return this.down('KeyE');
  }
}
