// Solara Bay itself: a sun-soaked coastal grid city built from boxes, procedural
// canvas textures and a handful of props. Also owns every collision box, so the
// rest of the game asks the city, never the scene graph.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { makeRng, pick, range, rangeInt } from './random.js';

function facadeTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Window grid: lit windows glow warm, the rest are dark glass.
  const cols = 4;
  const rows = 10;
  for (let r = 0; r < rows; r += 1) {
    for (let col = 0; col < cols; col += 1) {
      const litWin = Math.random() < 0.25;
      g.fillStyle = litWin ? '#ffd98a' : '#274b63';
      g.fillRect(10 + col * 28, 12 + r * 24, 18, 14);
    }
  }
  // Roofline band.
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 128, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2f36';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#3a3f47';
  for (let i = 0; i < 200; i += 1) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  // Centre dashes (the strip is laid along the road, so dashes run down the middle).
  g.fillStyle = '#e8c33a';
  g.fillRect(62, 0, 4, 40);
  g.fillRect(62, 64, 4, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5.5, 6), trunkMat);
  trunk.position.y = 2.75;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1);
    leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    group.add(leaf);
  }
  return group;
}

export class City {
  constructor(scene, seed = 7) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.colliders = []; // { minX, maxX, minZ, maxZ }
    this.clouds = [];
    this.water = null;
    this.buildings = [];
    this.build(scene);
  }

  build(scene) {
    const rng = this.rng;
    // Sky, fog and lights: a warm late-afternoon.
    scene.background = new THREE.Color(0x87b5d9);
    scene.fog = new THREE.Fog(0xcfd8e2, 180, 520);
    const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
    sun.position.set(120, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 600;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9));

    // Ground: grass base, sand strip and water to the west.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 520),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-240, 0, 0);
    sand.receiveShadow = true;
    scene.add(sand);

    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 520),
      new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(-350, 0.05, 0);
    scene.add(this.water);

    // Roads: asphalt strips with dashed centre lines, plus sidewalks.
    const roadTex = roadTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    for (const coord of CITY.roads) {
      for (const [w, len, x, z, rot] of [
        [12, 440, coord, 0, 0],
        [12, 440, 0, coord, Math.PI / 2],
      ]) {
        const tex = roadTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(1, len / 16);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const road = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat);
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = rot;
        road.position.set(x, 0.02, z);
        road.receiveShadow = true;
        scene.add(road);
      }
      // Sidewalk ribbons flanking each road.
      for (const off of [-10, 10]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(4, 440), walkMat);
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(coord + off, 0.04, 0);
        walk.receiveShadow = true;
        scene.add(walk);
        const walk2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 440), walkMat);
        walk2.rotation.x = -Math.PI / 2;
        walk2.position.set(0, 0.04, coord + off);
        walk2.receiveShadow = true;
        scene.add(walk2);
      }
    }

    // Buildings: one or two per block, facades from procedural textures.
    const facadeMats = PALETTE.facades.map((color) => {
      const hex = `#${color.toString(16).padStart(6, '0')}`;
      return new THREE.MeshLambertMaterial({ map: facadeTexture(hex, 0.25) });
    });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b6258 });
    const blockCenters = [-150, -90, -30, 30, 90, 150];
    for (const bx of blockCenters) {
      for (const bz of blockCenters) {
        // A few blocks are parks, not buildings.
        if (rng() < 0.14) {
          this.buildPark(scene, bx, bz, rng);
          continue;
        }
        const count = rng() < 0.45 ? 1 : 2;
        for (let i = 0; i < count; i += 1) {
          const w = range(rng, 18, 30);
          const d = range(rng, 18, 30);
          const h = range(rng, 9, count === 1 ? 46 : 26);
          const ox = count === 1 ? 0 : (i === 0 ? -12 : 12);
          const oz = count === 1 ? 0 : (i === 0 ? -10 : 10);
          const x = bx + ox;
          const z = bz + oz;
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pick(rng, facadeMats));
          mesh.position.set(x, h / 2, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
          const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat);
          roof.position.set(x, h + 0.25, z);
          scene.add(roof);
          // Rooftop AC box on tall towers.
          if (h > 24) {
            const ac = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), roofMat);
            ac.position.set(x + w / 5, h + 1.4, z);
            scene.add(ac);
          }
          this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
          this.buildings.push({ x, z, w, d, h });
        }
      }
    }

    // Landmark: Solara Bank gets a wide marble block with columns.
    this.buildBank(scene, -42, 138);

    // Palms along the beach and scattered on sidewalks.
    for (let z = -200; z <= 200; z += 28) {
      const palm = makePalm(rng);
      palm.position.set(-212 + range(rng, -3, 3), 0, z + range(rng, -4, 4));
      scene.add(palm);
    }
    for (let i = 0; i < 26; i += 1) {
      const road = pick(rng, CITY.roads);
      const along = range(rng, -190, 190);
      const palm = makePalm(rng);
      palm.position.set(road + (rng() < 0.5 ? -10 : 10), 0, along);
      scene.add(palm);
    }

    // Streetlights at every intersection corner.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const rx of CITY.roads) {
      for (const rz of CITY.roads) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), poleMat);
        pole.position.set(rx + 8.5, 3.5, rz + 8.5);
        scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
        lamp.position.set(rx + 8.5, 7.1, rz + 8.5);
        scene.add(lamp);
      }
    }

    // Clouds: flat white puffs drifting slowly.
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 10; i += 1) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 6, 12), 8, 6), cloudMat);
        puff.position.set(j * 8 - 12, range(rng, -1, 1), range(rng, -4, 4));
        puff.scale.y = 0.45;
        cloud.add(puff);
      }
      cloud.position.set(range(rng, -260, 260), range(rng, 70, 110), range(rng, -260, 260));
      scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  buildPark(scene, bx, bz, rng) {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 44),
      new THREE.MeshLambertMaterial({ color: 0x6fa055 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(bx, 0.03, bz);
    grass.receiveShadow = true;
    scene.add(grass);
    for (let i = 0; i < 5; i += 1) {
      const palm = makePalm(rng);
      palm.position.set(bx + range(rng, -16, 16), 0, bz + range(rng, -16, 16));
      scene.add(palm);
    }
    // A round fountain in the middle of the park.
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4.4, 1, 16),
      new THREE.MeshLambertMaterial({ color: 0xb8b0a0 }),
    );
    basin.position.set(bx, 0.5, bz);
    scene.add(basin);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.6, 0.4, 16),
      new THREE.MeshLambertMaterial({ color: PALETTE.water }),
    );
    water.position.set(bx, 0.9, bz);
    scene.add(water);
  }

  buildBank(scene, x, z) {
    const marble = new THREE.MeshLambertMaterial({ color: 0xe8e2d4 });
    const bank = new THREE.Mesh(new THREE.BoxGeometry(34, 16, 24), marble);
    bank.position.set(x, 8, z);
    bank.castShadow = true;
    bank.receiveShadow = true;
    scene.add(bank);
    const colMat = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });
    for (let i = -2; i <= 2; i += 1) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 12, 10), colMat);
      col.position.set(x + i * 6, 6, z - 13);
      col.castShadow = true;
      scene.add(col);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(20, 2.4, 1), new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }));
    sign.position.set(x, 15, z - 12.6);
    scene.add(sign);
    this.colliders.push({ minX: x - 17, maxX: x + 17, minZ: z - 12, maxZ: z + 12 });
  }

  // --- collision ------------------------------------------------------------
  collideCircle(x, z, r) {
    // Push a circle out of every building AABB it overlaps. Returns corrected [x, z].
    for (const b of this.colliders) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // Dead centre: push out along the smallest penetration axis.
          const pl = x - b.minX;
          const pr = b.maxX - x;
          const pt = z - b.minZ;
          const pb = b.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.minX - r;
          else if (m === pr) x = b.maxX + r;
          else if (m === pt) z = b.minZ - r;
          else z = b.maxZ + r;
        }
      }
    }
    return [x, z];
  }

  hitsBuilding(x, z, r) {
    for (const b of this.colliders) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  isOnRoad(x, z) {
    for (const c of CITY.roads) {
      if (Math.abs(x - c) <= CITY.roadHalf + 1 || Math.abs(z - c) <= CITY.roadHalf + 1) return true;
    }
    return false;
  }

  nearestRoad(x, z) {
    // Closest road coordinate and axis ('x' road runs along X at fixed z).
    let best = { axis: 'x', coord: 0, dist: Infinity };
    for (const c of CITY.roads) {
      const dz = Math.abs(z - c);
      if (dz < best.dist) best = { axis: 'x', coord: c, dist: dz };
      const dx = Math.abs(x - c);
      if (dx < best.dist) best = { axis: 'z', coord: c, dist: dx };
    }
    return best;
  }

  randomRoadPoint(rng) {
    const road = pick(rng, CITY.roads);
    const along = range(rng, -180, 180);
    if (rng() < 0.5) return { x: along, z: road };
    return { x: road, z: along };
  }

  update(dt) {
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 1.2;
      if (cloud.position.x > 300) cloud.position.x = -300;
    }
  }
}
