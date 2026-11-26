// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. ?seed=N fixes the valley; ?shot=start|
// play|cockpit|end stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot; ?selftest=1 runs a
// scripted control check and writes its results into #selftest.
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const selfTest = params.get('selftest') === '1';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const rng = makeRng(seed);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.colours.sky);
scene.fog = new THREE.Fog(CFG.colours.fog, 700, 3400);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 6000);
camera.position.set(0, 60, 940);

const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x5d6b4a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(CFG.colours.sun, 1.15);
sun.position.set(-600, 900, 400);
scene.add(sun);

const built = buildWorld(scene, rng);
const planeMesh = buildPlane();
scene.add(planeMesh);

const world = createWorld();
world.rings = built.rings;
world.best = readBest();
paintNextRing(world);

const hud = createHud();
const input = createInput(canvas);
const sfx = createSfx();

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 60, 940);
const lookTarget = new THREE.Vector3();
const _fwd2 = new THREE.Vector3();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* private windows */ }
}

function placeCamera(dt) {
  const f = world.flight;
  forwardVector(f.heading, f.pitch, _fwd2);
  if (world.cameraMode === 'cockpit') {
    camTarget.copy(f.pos).addScaledVector(_fwd2, 1.4);
    camTarget.y += 1.35;
    lookTarget.copy(f.pos).addScaledVector(_fwd2, 120);
    lookTarget.y += 6;
    camera.position.copy(camTarget);
    camera.lookAt(lookTarget);
    camera.rotation.z = -f.roll * 0.85;
  } else {
    camTarget.copy(f.pos).addScaledVector(_fwd2, -CFG.camera.chaseDistance);
    camTarget.y += CFG.camera.chaseHeight;
    // Lateral offset for staged shots: a negative side puts the plane right
    // of centre, clear of a centred overlay card.
    const sideX = Math.cos(f.heading), sideZ = Math.sin(f.heading);
    camTarget.x += sideX * (world.camSide || 0);
    camTarget.z += sideZ * (world.camSide || 0);
    const groundY = terrainHeight(camTarget.x, camTarget.z);
    if (camTarget.y < groundY + 4) camTarget.y = groundY + 4;
    camPos.lerp(camTarget, Math.min(1, dt * 6));
    lookTarget.copy(f.pos).addScaledVector(_fwd2, 40);
    lookTarget.y += 2;
    camera.position.copy(camPos);
    camera.lookAt(lookTarget);
  }
  hud.cockpit.classList.toggle('hidden', world.cameraMode !== 'cockpit');
  document.body.classList.toggle('cockpit-mode', world.cameraMode === 'cockpit');
}

function paintFrame(dt) {
  applyFlightToMesh(planeMesh, world.flight);
  planeMesh.visible = true;
  for (const cloud of built.clouds) {
    cloud.position.x += cloud.userData.drift * dt;
    if (cloud.position.x > 1900) cloud.position.x = -1900;
  }
  placeCamera(dt);
  updateHud(hud, world, dt);
  showScreen(hud, world.screen === 'title' ? 'title' : world.screen === 'pause' ? 'pause' : world.screen === 'end' ? 'end' : 'none');
  if (world.screen === 'end') {
    const reason = world.endReason;
    hud.endTitle.textContent = reason === 'complete' ? 'MISSION COMPLETE' : reason === 'crashed' ? 'AIRCRAFT LOST' : 'OUT OF FUEL';
    hud.endStats.textContent =
      'Score ' + world.score + '  ·  Rings ' + world.ringsPassed + '/' + CFG.mission.rings +
      '  ·  Time ' + formatTime(world.time) + '  ·  Best ' + Math.max(world.best, world.score);
    if (world.score > world.best) {
      world.best = world.score;
      saveBest(world.best);
    }
  }
  statusEl.textContent = 'Skyline Courier: score ' + world.score + ', rings ' + world.ringsPassed +
    ' of ' + CFG.mission.rings + ', fuel ' + Math.round(world.fuel) + ' percent.';
  renderer.render(scene, camera);
}

function runShot(name) {
  const staged = stageShot(name, world, planeMesh);
  if (!staged) return;
  placeCamera(10); // snap the chase camera onto the staged plane at once
  if (params.get('debug') === '1') {
    applyFlightToMesh(planeMesh, world.flight);
    const ndc = world.flight.pos.clone().project(camera);
    document.getElementById('selftest').textContent = JSON.stringify({
      cam: camera.position.toArray().map((v) => Math.round(v * 10) / 10),
      plane: world.flight.pos.toArray().map((v) => Math.round(v * 10) / 10),
      ndc: ndc.toArray().map((v) => Math.round(v * 100) / 100),
      heading: Math.round(world.flight.heading * 100) / 100,
      camSide: world.camSide,
      visible: planeMesh.visible,
    });
  }
  let painted = 0;
  function paint() {
    paintFrame(STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** Scripted control check: throttle + climb, then a ring pass. */
function runSelfTest() {
  const out = document.getElementById('selftest');
  const results = {};
  try {
    world.screen = 'title';
    input.pressed.confirm = true;
    updateWorld(world, input, STEP, hud, sfx);
    results.started = world.screen === 'play';
    input.throttleUp = true;
    input.pitchUp = true;
    for (let i = 0; i < 300; i++) updateWorld(world, input, STEP, hud, sfx);
    input.throttleUp = false;
    input.pitchUp = false;
    results.speedAfter5s = Math.round(world.flight.speed * 10) / 10;
    results.altitudeGain = Math.round((world.flight.pos.y - (terrainHeight(0, 1020) + 2.2)) * 10) / 10;
    results.fuelBurned = Math.round((100 - world.fuel) * 10) / 10;
    results.airborne = world.flight.airborne;
    const next = world.rings[world.ringsPassed];
    world.flight.pos.copy(next.pos);
    updateWorld(world, input, STEP, hud, sfx);
    results.ringPassed = world.ringsPassed === 1;
    results.scoreAfterRing = world.score;
    const groundY = terrainHeight(world.flight.pos.x, world.flight.pos.z);
    world.flight.pos.y = groundY + 0.5;
    world.flight.airborne = true;
    updateWorld(world, input, STEP, hud, sfx);
    results.crashEndsMission = world.screen === 'end' && world.endReason === 'crashed';
    results.ok = results.started && results.airborne && results.ringPassed && results.crashEndsMission;
  } catch (err) {
    results.error = String(err && err.message || err);
    results.ok = false;
  }
  out.textContent = JSON.stringify(results);
  document.title = 'selftest ' + JSON.stringify(results);
}

function runGame() {
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      updateWorld(world, input, STEP, hud, sfx);
      accumulator -= STEP;
      steps++;
    }
    if (steps === 5) accumulator = 0;
    paintFrame(elapsed);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (shotName) runShot(shotName);
else if (selfTest) { runSelfTest(); runGame(); }
else runGame();
