// Solara Bay — the city itself: roads, blocks, buildings, beach and sea.
// Everything is built from boxes, cylinders and canvas textures at load time.

import * as THREE from 'three';
import { WORLD, LANDMARKS } from './config.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function facadeTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#8d8578';
    g.fillRect(0, 0, w, h);
    for (let y = 14; y < h - 14; y += 30) {
      for (let x = 12; x < w - 12; x += 26) {
        const lit = Math.random() < 0.3;
        g.fillStyle = lit ? '#ffd98a' : '#2c3542';
        g.fillRect(x, y, 14, 18);
      }
    }
  });
}

function signTexture(text, bg, fg, sub) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg;
    g.font = 'bold 52px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, sub ? h / 2 - 16 : h / 2);
    if (sub) {
      g.font = '28px Arial';
      g.fillText(sub, w / 2, h / 2 + 34);
    }
  });
}

function roadTexture(horizontal) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#33363b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f5d76e';
    if (horizontal) {
      g.fillRect(8, h / 2 - 2, 44, 4);
      g.fillRect(72, h / 2 - 2, 44, 4);
    } else {
      g.fillRect(w / 2 - 2, 8, 4, 44);
      g.fillRect(w / 2 - 2, 72, 4, 44);
    }
    g.fillStyle = '#3a3d42';
    for (let i = 0; i < 40; i++) {
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

const PALETTE = [0x9a8f7a, 0x7a8ba0, 0xa08a7a, 0x8a9a7a, 0xb0a090, 0x6a7a8a, 0x93818f, 0x7d8a6a];

function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function buildCity(scene) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';

  // Ground: grass, then sand, then sea to the east.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x5d8a4a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, -0.05, 0);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 420),
    new THREE.MeshLambertMaterial({ color: 0xd9c28a })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(WORLD.EDGE + 7, 0.0, 0);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 700),
    new THREE.MeshLambertMaterial({ color: 0x2a6a9a, transparent: true, opacity: 0.92 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(WORLD.WATER_X + 70, 0.02, 0);
  group.add(sea);

  // Roads: asphalt strips with a dashed centre line. East-west roads run
  // along X at each road z; north-south roads run along Z at each road x.
  // Each direction gets its own dash orientation — no texture rotation.
  const span = 340;
  for (const c of WORLD.ROADS) {
    // East-west: dashes run along X.
    const texX = roadTexture(true);
    texX.wrapS = THREE.RepeatWrapping;
    texX.wrapT = THREE.RepeatWrapping;
    texX.repeat.set(span / 16, 1);
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(span, WORLD.ROAD_WIDTH), new THREE.MeshLambertMaterial({ map: texX }));
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(0, 0.01, c);
    group.add(rx);
    // North-south: dashes run along Z as drawn.
    const texZ = roadTexture(false);
    texZ.wrapS = THREE.RepeatWrapping;
    texZ.wrapT = THREE.RepeatWrapping;
    texZ.repeat.set(1, span / 16);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.ROAD_WIDTH, span), new THREE.MeshLambertMaterial({ map: texZ }));
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(c, 0.01, 0);
    group.add(rz);
  }

  // Blocks: pavement slabs between the roads.
  const paveMat = new THREE.MeshLambertMaterial({ color: 0x9a958a });
  const centres = [-125, -75, -25, 25, 75, 125];
  for (const bx of centres) {
    for (const bz of centres) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(40, 0.3, 40), paveMat);
      slab.position.set(bx, 0.05, bz);
      group.add(slab);
    }
  }

  // Buildings: one to three boxes per block, windows via a shared texture.
  const facade = facadeTexture();
  const buildingSpots = [];
  for (const bx of centres) {
    for (const bz of centres) {
      const isLandmarkBlock =
        (bx === -75 && bz === -75) || (bx === -25 && bz === 25) ||
        (bx === 75 && bz === -75) || (bx === 125 && bz === 125);
      if (isLandmarkBlock) continue;
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const w = rand(12, 20);
        const d = rand(12, 20);
        const h = rand(9, 42);
        const ox = bx + rand(-9, 9);
        const oz = bz + rand(-9, 9);
        const mat = new THREE.MeshLambertMaterial({
          map: facade,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(ox, h / 2 + 0.2, oz);
        group.add(b);
        colliders.push({ minX: ox - w / 2, maxX: ox + w / 2, minZ: oz - d / 2, maxZ: oz + d / 2 });
        buildingSpots.push({ x: ox, z: oz, w, d, h });
        if (Math.random() < 0.4) {
          const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 2.5, d * 0.4), new THREE.MeshLambertMaterial({ color: 0x555550 }));
          roof.position.set(ox, h + 1.4, oz);
          group.add(roof);
        }
      }
    }
  }

  // --- Landmarks -----------------------------------------------------------
  function signBox(x, z, w, h, d, texture, y) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ map: texture })
    );
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }

  // Rosa's Cafe: low corner building, warm sign, red awning.
  const cafeMat = new THREE.MeshLambertMaterial({ color: 0xc96f4a });
  const cafe = new THREE.Mesh(new THREE.BoxGeometry(22, 7, 16), cafeMat);
  cafe.position.set(LANDMARKS.cafe.x, 3.7, LANDMARKS.cafe.z);
  group.add(cafe);
  signBox(LANDMARKS.cafe.x, LANDMARKS.cafe.z + 8.2, 18, 3.4, 0.4, signTexture("ROSA'S CAFE", '#5a2d1a', '#ffd98a'), 5.6);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0x8a1f1f }));
  awning.position.set(LANDMARKS.cafe.x, 3.4, LANDMARKS.cafe.z + 9);
  group.add(awning);
  // The collider reaches past the awning (z +11), so the camera never
  // ends up pressed against it when the player walks up to the cafe.
  colliders.push({ minX: LANDMARKS.cafe.x - 11, maxX: LANDMARKS.cafe.x + 11, minZ: LANDMARKS.cafe.z - 8, maxZ: LANDMARKS.cafe.z + 11 });

  // Solara Bank: tall, columns, gold sign.
  const bankMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  const bank = new THREE.Mesh(new THREE.BoxGeometry(24, 26, 18), bankMat);
  bank.position.set(LANDMARKS.bank.x, 13.2, LANDMARKS.bank.z);
  group.add(bank);
  signBox(LANDMARKS.bank.x, LANDMARKS.bank.z + 9.2, 20, 3.6, 0.4, signTexture('SOLARA BANK', '#1a2a4a', '#f5d76e'), 20);
  for (let i = -1; i <= 1; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 12, 10), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
    col.position.set(LANDMARKS.bank.x + i * 7, 6.2, LANDMARKS.bank.z + 9.5);
    group.add(col);
  }
  // The collider reaches past the columns and sign (z +11).
  colliders.push({ minX: LANDMARKS.bank.x - 12, maxX: LANDMARKS.bank.x + 12, minZ: LANDMARKS.bank.z - 9, maxZ: LANDMARKS.bank.z + 11 });

  // Bay Clinic: white block, red cross sign.
  const clinic = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 16), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
  clinic.position.set(LANDMARKS.clinic.x, 6.2, LANDMARKS.clinic.z);
  group.add(clinic);
  signBox(LANDMARKS.clinic.x, LANDMARKS.clinic.z + 8.2, 12, 3.2, 0.4, signTexture('CLINIC +', '#ffffff', '#c02020'), 9.5);
  // The collider reaches past the sign (z +9).
  colliders.push({ minX: LANDMARKS.clinic.x - 10, maxX: LANDMARKS.clinic.x + 10, minZ: LANDMARKS.clinic.z - 8, maxZ: LANDMARKS.clinic.z + 9 });

  // Safehouse: small house with a garage door.
  const house = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 12), new THREE.MeshLambertMaterial({ color: 0x7a9a6a }));
  house.position.set(LANDMARKS.safehouse.x, 3.2, LANDMARKS.safehouse.z);
  group.add(house);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(11, 4, 4), new THREE.MeshLambertMaterial({ color: 0x6a4a3a }));
  roof.position.set(LANDMARKS.safehouse.x, 8, LANDMARKS.safehouse.z);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  colliders.push({ minX: LANDMARKS.safehouse.x - 7, maxX: LANDMARKS.safehouse.x + 7, minZ: LANDMARKS.safehouse.z - 6, maxZ: LANDMARKS.safehouse.z + 6 });

  // The Docks: wooden pier into the sea, crates and a mooring post row.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 8), pierMat);
  pier.position.set(172, 0.8, 25);
  group.add(pier);
  for (let i = 0; i < 5; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: 0xa8845a }));
    crate.position.set(164 + i * 3.4, 2.2, 21 + (i % 2) * 6);
    crate.rotation.y = rand(0, 1);
    group.add(crate);
    colliders.push({ minX: crate.position.x - 1.2, maxX: crate.position.x + 1.2, minZ: crate.position.z - 1.2, maxZ: crate.position.z + 1.2 });
  }

  // Marina Plaza: fountain and benches in the block at (25, 75).
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 1.2, 20), new THREE.MeshLambertMaterial({ color: 0x9a9a9a }));
  basin.position.set(25, 0.8, 75);
  group.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.4, 20), new THREE.MeshLambertMaterial({ color: 0x3a8ab0 }));
  water.position.set(25, 1.4, 75);
  group.add(water);
  colliders.push({ minX: 19.5, maxX: 30.5, minZ: 69.5, maxZ: 80.5 });

  // Streetlights at every other intersection.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0xaa8833 });
  for (let i = 0; i < WORLD.ROADS.length; i += 2) {
    for (let j = 0; j < WORLD.ROADS.length; j += 2) {
      const x = WORLD.ROADS[i] + 6;
      const z = WORLD.ROADS[j] + 6;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 8), poleMat);
      pole.position.set(x, 3.5, z);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), lampMat);
      lamp.position.set(x, 7.1, z);
      group.add(lamp);
    }
  }

  // Palm trees along the beach.
  for (let z = -160; z <= 160; z += 28) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 8), new THREE.MeshLambertMaterial({ color: 0x7a5c38 }));
    trunk.position.set(168, 3, z + rand(-4, 4));
    trunk.rotation.z = 0.12;
    group.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 8), new THREE.MeshLambertMaterial({ color: 0x3a7a3a }));
    top.position.set(168.8, 7.4, z + rand(-4, 4));
    group.add(top);
  }

  scene.add(group);
  return { colliders, group };
}

export function nearestRoadPoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const rx of WORLD.ROADS) {
    for (const rz of WORLD.ROADS) {
      const d = (rx - x) * (rx - x) + (rz - z) * (rz - z);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, z: rz };
      }
    }
  }
  return best;
}

export function randomRoadPoint(minDist, fromX, fromZ) {
  for (let tries = 0; tries < 40; tries++) {
    const p = {
      x: WORLD.ROADS[Math.floor(Math.random() * WORLD.ROADS.length)],
      z: WORLD.ROADS[Math.floor(Math.random() * WORLD.ROADS.length)],
    };
    const d = Math.hypot(p.x - fromX, p.z - fromZ);
    if (d >= minDist) return p;
  }
  return { x: 0, z: 0 };
}
