// The courier plane: a low-poly prop aircraft built from primitives, and
// the arcade flight model that flies it. Heading 0 is north (-Z); compass
// degrees run clockwise from north, so east is 90.
const PLANE = CFG.plane;

/** Build the aircraft mesh. It faces -Z so rotation.y = heading just works. */
function buildPlane() {
  const C = CFG.colours;
  const bodyMat = new THREE.MeshLambertMaterial({ color: C.planeBody });
  const trimMat = new THREE.MeshLambertMaterial({ color: C.planeTrim });
  const glassMat = new THREE.MeshLambertMaterial({ color: C.planeGlass });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });

  const plane = new THREE.Group();

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.4, 10), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  plane.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 10), trimMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  plane.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8), glassMat);
  canopy.scale.set(0.9, 0.75, 1.5);
  canopy.position.set(0, 0.62, -0.9);
  plane.add(canopy);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 1.9), bodyMat);
  wing.position.set(0, -0.1, -0.4);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 1.9), trimMat);
    tip.position.set(side * 5.55, -0.1, -0.4);
    plane.add(tip);
  }

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 1.2), bodyMat);
  tailWing.position.set(0, 0.25, 2.5);
  plane.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.3), trimMat);
  fin.position.set(0, 0.9, 2.5);
  plane.add(fin);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.87, 0.5, 10), trimMat);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.6;
  plane.add(stripe);

  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), darkMat);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -4.2;
  prop.add(spinner);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.08), darkMat);
    blade.rotation.z = angle;
    blade.position.z = -4.05;
    prop.add(blade);
  }
  plane.add(prop);
  plane.userData.prop = prop;

  // Navigation lights: red on the left tip, green on the right.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  navL.position.set(-5.8, -0.1, -0.4);
  plane.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navR.position.set(5.8, -0.1, -0.4);
  plane.add(navR);

  return plane;
}

/** Fresh flight state: parked on the runway, engine idling. */
function createFlight() {
  return {
    pos: new THREE.Vector3(CFG.runway.x, terrainHeight(CFG.runway.x, CFG.runway.z) + 2.2, CFG.runway.z + 120),
    heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    airborne: false, landed: true,
  };
}

/** Forward unit vector from heading and pitch. */
function forwardVector(heading, pitch, out) {
  const cp = Math.cos(pitch);
  out.set(Math.sin(heading) * cp, Math.sin(pitch), -Math.cos(heading) * cp);
  return out;
}

const _fwd = new THREE.Vector3();

/**
 * Advance the flight model one fixed step. Returns nothing; the world reads
 * the state for ring checks, terrain collision and landing detection.
 */
function updateFlight(f, input, dt) {
  // Throttle: W / Shift up, S / Ctrl down.
  if (input.throttleUp) f.throttle = Math.min(1, f.throttle + 0.55 * dt);
  if (input.throttleDown) f.throttle = Math.max(0, f.throttle - 0.7 * dt);

  // Roll and pitch targets from keys, blended with the mouse.
  let rollTarget = 0, pitchTarget = 0;
  if (input.rollLeft) rollTarget += 1;
  if (input.rollRight) rollTarget -= 1;
  if (input.pitchUp) pitchTarget += 1;
  if (input.pitchDown) pitchTarget -= 1;
  if (input.mouseActive) {
    rollTarget += -input.mouseX * 1.4;
    pitchTarget += -input.mouseY * 1.1;
  }
  rollTarget = Math.max(-1, Math.min(1, rollTarget));
  pitchTarget = Math.max(-1, Math.min(1, pitchTarget));

  const stalled = f.speed < PLANE.stallSpeed && f.airborne;
  const authority = stalled ? 0.45 : 1;
  const rollRate = PLANE.rollRate * authority;
  const pitchRate = PLANE.pitchRate * authority;
  const rollGoal = rollTarget * 1.05;
  const pitchGoal = pitchTarget * 0.5;
  f.roll += Math.max(-rollRate * dt, Math.min(rollRate * dt, rollGoal - f.roll));
  f.pitch += Math.max(-pitchRate * dt, Math.min(pitchRate * dt, pitchGoal - f.pitch));
  // Ease back toward level when the pilot lets go.
  if (rollTarget === 0) f.roll *= Math.max(0, 1 - 1.4 * dt);
  if (pitchTarget === 0) f.pitch *= Math.max(0, 1 - 1.8 * dt);

  // Bank turns the plane; the turn tightens as speed rises.
  f.heading += Math.sin(f.roll) * PLANE.turnFactor * dt * (0.55 + f.speed / PLANE.cruiseSpeed);

  // Speed chases the throttle setting.
  const targetSpeed = PLANE.minSpeed + f.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
  const accel = f.speed < targetSpeed ? 14 : 9;
  f.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - f.speed));

  // Move along the nose.
  forwardVector(f.heading, f.pitch, _fwd);
  f.pos.addScaledVector(_fwd, f.speed * dt);

  // Stall: below flying speed the plane sinks instead of climbing.
  if (stalled) f.pos.y -= PLANE.sinkRate * (1 - f.speed / PLANE.stallSpeed) * dt;

  // Takeoff: once fast enough and pitched up, leave the ground.
  if (!f.airborne && f.speed > PLANE.stallSpeed + 4 && f.pitch > 0.06) {
    f.airborne = true;
    f.landed = false;
  }
}

/** Copy flight state onto the mesh (rotation order YXZ: yaw, pitch, bank). */
function applyFlightToMesh(mesh, f) {
  mesh.position.copy(f.pos);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = f.heading;
  mesh.rotation.x = f.pitch;
  mesh.rotation.z = -f.roll;
  mesh.userData.prop.rotation.z += (2 + f.throttle * 38) * STEP;
}
