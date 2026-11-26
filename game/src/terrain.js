// The valley: one analytic height function drives the terrain mesh, the
// river carve, the runway flattening and every ground collision, so what
// you see is exactly what you can hit.
const TERRAIN_SEED = 20261126;

/** Height of the ground at (x, z), in metres. */
function terrainHeight(x, z) {
  // Rolling hills across the valley floor.
  let h = fbm2(x * 0.0016 + 3.1, z * 0.0016 + 7.7, TERRAIN_SEED) * 58;
  h += fbm2(x * 0.00045 + 11.0, z * 0.00045 + 2.0, TERRAIN_SEED + 31) * 26;
  // Mountain rim: the valley is ringed by high peaks.
  const r = Math.sqrt(x * x + z * z);
  const rim = smooth(Math.min(1, Math.max(0, (r - CFG.world.mountainRim) / 500)));
  h += rim * CFG.world.mountainHeight * (0.65 + 0.55 * fbm2(x * 0.001, z * 0.001, TERRAIN_SEED + 55));
  // River carve: a winding river runs along the south of the valley.
  const riverZ = -420 + 260 * Math.sin(x * 0.0011 + 1.7);
  const riverDist = Math.abs(z - riverZ);
  const carve = smooth(Math.min(1, Math.max(0, 1 - riverDist / 130)));
  h = h * (1 - carve * 0.85) + 2.5 * carve;
  // Runway flatten: a flat apron around the strip so landings are fair.
  // Fully flat over the strip itself, blending out over the next 80 m.
  const rx = Math.abs(x - CFG.runway.x);
  const rz = Math.abs(z - CFG.runway.z);
  const flat = smooth(Math.min(1, Math.max(0, 1 - Math.max((rx - 60) / 80, (rz - 230) / 80))));
  h = h * (1 - flat) + 8 * flat;
  return h;
}

/** The river's centre line, shared by the carve and the water ribbon. */
function riverCentreZ(x) {
  return -420 + 260 * Math.sin(x * 0.0011 + 1.7);
}

function colourForHeight(h, slope, out) {
  if (h > 210) return out.setHex(CFG.colours.snow);
  if (h > 130 || slope > 0.55) return out.setHex(CFG.colours.rock);
  if (h < 6) return out.setHex(CFG.colours.sand);
  // Grass darkens in the hollows, brightens on the open slopes.
  const t = Math.min(1, Math.max(0, h / 90));
  out.setHex(CFG.colours.grassLow).lerp(new THREE.Color(CFG.colours.grassHigh), t);
  return out;
}

/** Build the terrain mesh, river, runway, town, trees, clouds and rings. */
function buildWorld(scene, rng) {
  const C = CFG.colours;

  // --- Terrain -----------------------------------------------------------
  const geo = new THREE.PlaneGeometry(CFG.world.size, CFG.world.size, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // Slope estimate from neighbours, for rock on steep faces.
    const slope = Math.abs(terrainHeight(x + 8, z) - h) / 8 + Math.abs(terrainHeight(x, z + 8) - h) / 8;
    colourForHeight(h, slope, tmp);
    colours[i * 3] = tmp.r; colours[i * 3 + 1] = tmp.g; colours[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  terrain.name = 'terrain';
  scene.add(terrain);

  // --- River ribbon ------------------------------------------------------
  const riverPts = [];
  for (let x = -1900; x <= 1900; x += 100) riverPts.push(new THREE.Vector3(x, 3.4, riverCentreZ(x)));
  const riverCurve = new THREE.CatmullRomCurve3(riverPts);
  const riverGeo = new THREE.PlaneGeometry(1, 1, 60, 1);
  const riverPos = riverGeo.attributes.position;
  for (let i = 0; i < riverPos.count; i++) {
    const u = riverPos.getX(i) + 0.5;
    const p = riverCurve.getPoint(u);
    const tangent = riverCurve.getTangent(u);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
    riverPos.setXYZ(i, p.x + side.x * riverPos.getY(i) * 90, 3.4, p.z + side.z * riverPos.getY(i) * 90);
  }
  riverGeo.computeVertexNormals();
  const river = new THREE.Mesh(riverGeo, new THREE.MeshLambertMaterial({ color: C.river }));
  river.name = 'river';
  scene.add(river);

  // --- Runway ------------------------------------------------------------
  const runway = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.runway.width, CFG.runway.length),
    new THREE.MeshLambertMaterial({ color: C.runway }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(CFG.runway.x, 8.4, CFG.runway.z);
  runway.add(strip);
  // Centre dashes and threshold bars.
  const markMat = new THREE.MeshBasicMaterial({ color: C.runwayMark });
  for (let dz = -180; dz <= 180; dz += 45) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 18), markMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(CFG.runway.x, 8.55, CFG.runway.z + dz);
    runway.add(dash);
  }
  for (const dz of [-196, 196]) {
    for (const dx of [-12, -4, 4, 12]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(4, 14), markMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(CFG.runway.x + dx, 8.55, CFG.runway.z + dz);
      runway.add(bar);
    }
  }
  // Windsock beside the strip.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
  pole.position.set(CFG.runway.x + 34, 12.5, CFG.runway.z + 150);
  runway.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 8), new THREE.MeshLambertMaterial({ color: 0xff7a1a }));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(CFG.runway.x + 38, 16.4, CFG.runway.z + 150);
  runway.add(sock);
  scene.add(runway);

  // --- Town beside the runway -------------------------------------------
  const town = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ color: C.townWall });
  const roofMat = new THREE.MeshLambertMaterial({ color: C.townRoof });
  for (let i = 0; i < 26; i++) {
    const hx = -300 + rng() * 260;
    const hz = 560 + rng() * 260;
    if (Math.abs(hx - CFG.runway.x) < 70) continue;
    const w = 14 + rng() * 14, d = 12 + rng() * 12, hgt = 8 + rng() * 10;
    const gy = terrainHeight(hx, hz);
    const house = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), wallMat);
    walls.position.y = hgt / 2;
    house.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 5 + rng() * 3, 4), roofMat);
    roof.position.y = hgt + 2.5;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    house.position.set(hx, gy - 0.5, hz);
    town.add(house);
  }
  scene.add(town);

  // --- Trees --------------------------------------------------------------
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 320 && guard < 4000) {
    guard++;
    const x = (rng() * 2 - 1) * 1750;
    const z = (rng() * 2 - 1) * 1750;
    if (Math.abs(x - CFG.runway.x) < 120 && Math.abs(z - CFG.runway.z) < 320) continue;
    if (Math.abs(z - riverCentreZ(x)) < 60) continue;
    const h = terrainHeight(x, z);
    if (h > 120) continue;
    treeSpots.push([x, h, z, 0.8 + rng() * 0.9]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
  const topGeo = new THREE.ConeGeometry(3.4, 10, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: C.treeTrunk });
  const topMat = new THREE.MeshLambertMaterial({ color: C.treeTop });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const tops = new THREE.InstancedMesh(topGeo, topMat, treeSpots.length);
  const m4 = new THREE.Matrix4();
  treeSpots.forEach(([x, y, z, s], i) => {
    m4.makeScale(s, s, s);
    m4.setPosition(x, y + 2.5 * s, z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(s, s, s);
    m4.setPosition(x, y + (5 + 5) * s, z);
    tops.setMatrixAt(i, m4);
  });
  scene.add(trunks);
  scene.add(tops);

  // --- Clouds --------------------------------------------------------------
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const cloudPuffs = [];
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < puffs; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rng() * 10, 8, 6), cloudMat);
      s.position.set((rng() * 2 - 1) * 22, (rng() * 2 - 1) * 3, (rng() * 2 - 1) * 10);
      s.scale.y = 0.45;
      cloud.add(s);
    }
    cloud.position.set((rng() * 2 - 1) * 1800, 190 + rng() * 110, (rng() * 2 - 1) * 1800);
    cloud.userData.drift = 2 + rng() * 3;
    clouds.add(cloud);
    cloudPuffs.push(cloud);
  }
  scene.add(clouds);

  // --- Mission rings -------------------------------------------------------
  const ringDefs = [
    [0, 118, 320], [-640, 150, -160], [-920, 195, -880],
    [140, 175, -1250], [940, 155, -720], [720, 135, 240],
  ];
  const rings = ringDefs.map(([x, y, z], i) => {
    const group = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(CFG.mission.ringRadius, 1.8, 12, 42),
      new THREE.MeshBasicMaterial({ color: C.ringFar }),
    );
    group.add(torus);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(CFG.mission.ringRadius - 2, 32),
      new THREE.MeshBasicMaterial({ color: C.ringFar, transparent: true, opacity: 0.10, side: THREE.DoubleSide }),
    );
    group.add(inner);
    // Face the ring toward the previous waypoint so the pilot flies through it.
    const prev = ringDefs[(i + ringDefs.length - 1) % ringDefs.length];
    group.position.set(x, y, z);
    group.lookAt(prev[0], prev[1], prev[2]);
    group.userData.index = i;
    group.userData.torus = torus;
    group.userData.inner = inner;
    scene.add(group);
    return { pos: new THREE.Vector3(x, y, z), group, passed: false };
  });

  return { rings, clouds: cloudPuffs };
}
