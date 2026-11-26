// Screenshot staging: ?shot=start|play|cockpit|end (with &seed=N) poses the
// game in that scene instead of running the loop, paints it twice and sets
// window.__shotReady so a headless browser can capture it. Each branch
// resets the mission first, then poses the fresh flight state: resetMission
// replaces world.flight, so the pose must read it after the reset.
function stageShot(name, world, planeMesh) {
  if (name === 'start') {
    // Parked on the runway: title screen over the strip, town to the left.
    world.screen = 'title';
    const f = world.flight;
    f.pos.set(CFG.runway.x, terrainHeight(CFG.runway.x, CFG.runway.z) + 2.2, CFG.runway.z + 150);
    f.heading = 0; f.pitch = 0; f.roll = 0;
    f.speed = 0; f.throttle = 0.35; f.airborne = false; f.landed = true;
    world.cameraMode = 'chase';
    world.camSide = -10; // plane sits right of centre, clear of the title card
    return { screen: 'title', camera: 'chase' };
  }
  if (name === 'play') {
    // Mid-flight past ring 1, banking toward ring 2: the amber ring ahead.
    world.screen = 'play';
    resetMission(world);
    world.ringsPassed = 1;
    world.rings[0].passed = true;
    paintNextRing(world);
    const f = world.flight;
    f.pos.set(-200, 150, 100);
    f.heading = 4.97; f.pitch = 0.02; f.roll = -0.28;
    f.speed = 58; f.throttle = 0.72; f.airborne = true; f.landed = false;
    world.fuel = 82; world.score = 100; world.time = 47;
    world.cameraMode = 'chase';
    return { screen: 'play', camera: 'chase' };
  }
  if (name === 'cockpit') {
    // Cockpit view on approach to ring 3, instruments lit, ring ahead.
    world.screen = 'play';
    resetMission(world);
    world.ringsPassed = 2;
    world.rings[0].passed = true;
    world.rings[1].passed = true;
    paintNextRing(world);
    const f = world.flight;
    f.pos.set(-720, 190, -620);
    f.heading = 5.63; f.pitch = -0.04; f.roll = 0.18;
    f.speed = 64; f.throttle = 0.8; f.airborne = true; f.landed = false;
    world.fuel = 71; world.score = 200; world.time = 96;
    world.cameraMode = 'cockpit';
    return { screen: 'play', camera: 'cockpit' };
  }
  if (name === 'end') {
    // Mission complete: all rings green, plane home on the runway.
    world.screen = 'end';
    resetMission(world);
    for (const ring of world.rings) ring.passed = true;
    world.ringsPassed = CFG.mission.rings;
    paintNextRing(world);
    world.score = 600 + 214;
    world.time = 386;
    world.fuel = 58;
    world.endReason = 'complete';
    const f = world.flight;
    f.pos.set(CFG.runway.x, terrainHeight(CFG.runway.x, CFG.runway.z) + 2.2, CFG.runway.z + 40);
    f.heading = 0; f.pitch = 0; f.roll = 0;
    f.speed = 0; f.throttle = 0; f.airborne = false; f.landed = true;
    world.cameraMode = 'chase';
    world.camSide = -10; // plane sits right of centre, clear of the end card
    return { screen: 'end', camera: 'chase' };
  }
  return null;
}
