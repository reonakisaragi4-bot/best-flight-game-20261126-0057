// The mission: fly the glowing rings in order, mind the fuel, and come home.
// Screens: title -> play -> pause / end (crashed, out of fuel, or complete).
// Landing on the runway refuels and repairs the plane; hitting the ground
// anywhere else ends the sortie.
function createWorld() {
  return {
    screen: 'title',
    flight: createFlight(),
    rings: [],
    fuel: CFG.fuel.start,
    damage: 0,
    score: 0,
    time: 0,
    ringsPassed: 0,
    banner: 'COURIER RUN — fly the rings in order, then land home',
    endReason: '',
    cameraMode: 'chase',
    camSide: 0, // lateral camera offset (m) for staged shots; 0 in normal play
    muted: false,
    landedBonusArmed: false,
    best: 0,
  };
}

/** Reset the mission: plane back on the runway, rings lit again. */
function resetMission(w) {
  w.flight = createFlight();
  w.fuel = CFG.fuel.start;
  w.damage = 0;
  w.score = 0;
  w.time = 0;
  w.ringsPassed = 0;
  w.landedBonusArmed = false;
  w.camSide = 0;
  w.banner = 'COURIER RUN — fly the rings in order, then land home';
  for (const ring of w.rings) {
    ring.passed = false;
    ring.group.userData.torus.material.color.setHex(CFG.colours.ringFar);
    ring.group.userData.inner.material.color.setHex(CFG.colours.ringFar);
    ring.group.scale.setScalar(1);
  }
  paintNextRing(w);
}

/** Colour the next ring amber, passed rings green, the rest red. */
function paintNextRing(w) {
  w.rings.forEach((ring, i) => {
    const torus = ring.group.userData.torus;
    const inner = ring.group.userData.inner;
    if (ring.passed) {
      torus.material.color.setHex(CFG.colours.ringDone);
      inner.material.color.setHex(CFG.colours.ringDone);
    } else if (i === w.ringsPassed) {
      torus.material.color.setHex(CFG.colours.ringNext);
      inner.material.color.setHex(CFG.colours.ringNext);
    } else {
      torus.material.color.setHex(CFG.colours.ringFar);
      inner.material.color.setHex(CFG.colours.ringFar);
    }
  });
}

function overRunway(f) {
  return (
    Math.abs(f.pos.x - CFG.runway.x) < CFG.runway.width / 2 + 8 &&
    Math.abs(f.pos.z - CFG.runway.z) < CFG.runway.length / 2
  );
}

/** Tiny WebAudio bleeps; created on first user gesture, never from a file. */
function createSfx() {
  let ctx = null;
  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
    }
    return ctx;
  }
  function beep(freq, dur, type, gain) {
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  }
  return {
    ring() { beep(880, 0.18, 'sine', 0.14); setTimeout(() => beep(1318, 0.22, 'sine', 0.12), 90); },
    click() { beep(520, 0.07, 'square', 0.06); },
    crash() { beep(90, 0.5, 'sawtooth', 0.2); },
    warn() { beep(330, 0.15, 'square', 0.08); },
  };
}

function endMission(w, reason) {
  w.screen = 'end';
  w.endReason = reason;
  if (reason === 'complete') {
    const timeBonus = Math.max(0, Math.round(600 - w.time));
    w.score += timeBonus;
    w.banner = 'MISSION COMPLETE';
  } else if (reason === 'crashed') {
    w.banner = 'AIRCRAFT LOST';
  } else {
    w.banner = 'OUT OF FUEL';
  }
}

/** One fixed step of the mission. hud is only used for toasts. */
function updateWorld(w, input, dt, hud, sfx) {
  if (input.pressed.mute) w.muted = !w.muted;
  if (input.pressed.camera) {
    w.cameraMode = w.cameraMode === 'chase' ? 'cockpit' : 'chase';
  }

  if (w.screen === 'title') {
    if (input.pressed.confirm) {
      resetMission(w);
      w.screen = 'play';
      sfx.click();
    }
    input.consume();
    return;
  }

  if (w.screen === 'pause') {
    if (input.pressed.pause || input.pressed.confirm) w.screen = 'play';
    if (input.pressed.restart) { resetMission(w); w.screen = 'play'; }
    input.consume();
    return;
  }

  if (w.screen === 'end') {
    if (input.pressed.confirm || input.pressed.restart) {
      resetMission(w);
      w.screen = 'play';
      sfx.click();
    }
    input.consume();
    return;
  }

  // --- playing -----------------------------------------------------------
  if (input.pressed.pause) {
    w.screen = 'pause';
    input.consume();
    return;
  }
  if (input.pressed.restart) {
    resetMission(w);
    input.consume();
    return;
  }

  const f = w.flight;
  const wasAirborne = f.airborne;
  const prevY = f.pos.y;
  updateFlight(f, input, dt);
  const verticalSpeed = (f.pos.y - prevY) / dt;
  w.time += dt;

  // Fuel: throttle burns it; empty tanks mean the engine is out.
  if (f.airborne || f.speed > 1) {
    w.fuel -= (CFG.fuel.drainBase + f.throttle * CFG.fuel.drainThrottle) * dt;
  }
  if (w.fuel <= 0) {
    w.fuel = 0;
    f.throttle = 0;
    if (!w.warnedFuel) {
      w.warnedFuel = true;
      flashToast(hud, 'OUT OF FUEL — glide to the runway!', 3);
      sfx.warn();
    }
  } else if (w.fuel < 25 && !w.warnedLow) {
    w.warnedLow = true;
    flashToast(hud, 'LOW FUEL — land on the runway to refuel', 3);
    sfx.warn();
  }

  // Ring check: the next ring in order only.
  const next = w.rings[w.ringsPassed];
  if (next) {
    const d = f.pos.distanceTo(next.pos);
    if (d < CFG.mission.ringRadius) {
      next.passed = true;
      w.ringsPassed += 1;
      w.score += CFG.mission.ringScore;
      w.fuel = Math.min(100, w.fuel + CFG.fuel.ringBonus);
      w.landedBonusArmed = true;
      flashToast(hud, 'RING ' + w.ringsPassed + ' CLEAR  +100', 1.8);
      sfx.ring();
      paintNextRing(w);
      if (w.ringsPassed >= CFG.mission.rings) {
        endMission(w, 'complete');
        sfx.ring();
        input.consume();
        return;
      }
    }
    // Pulse the next ring so it reads at a glance.
    const pulse = 1 + 0.05 * Math.sin(w.time * 4);
    next.group.scale.setScalar(pulse);
  }

  // Ground contact.
  const groundY = terrainHeight(f.pos.x, f.pos.z);
  if (f.pos.y <= groundY + 1.6) {
    if (overRunway(f) && f.airborne) {
      // Landing: gentle and slow is a good one, fast or steep is a hard one.
      const gentle = verticalSpeed > -6 && f.speed < 55;
      f.pos.y = groundY + 2.2;
      f.pitch = 0;
      f.roll *= 0.3;
      f.speed = Math.min(f.speed, 30);
      f.airborne = false;
      f.landed = true;
      f.throttle = 0;
      w.fuel = CFG.fuel.refill;
      w.damage = Math.max(0, w.damage - CFG.damage.repairOnLand);
      w.warnedFuel = false;
      w.warnedLow = false;
      if (!gentle) {
        w.damage += CFG.damage.hardLanding;
        flashToast(hud, 'HARD LANDING — damage +' + CFG.damage.hardLanding + '%', 2.5);
        sfx.crash();
      } else if (w.landedBonusArmed) {
        w.score += CFG.mission.landingBonus;
        w.landedBonusArmed = false;
        flashToast(hud, 'LANDED — refuelled, repaired, +' + CFG.mission.landingBonus, 2.5);
        sfx.click();
      } else {
        flashToast(hud, 'LANDED — refuelled and repaired', 2);
        sfx.click();
      }
    } else if (f.airborne || f.speed > 5) {
      // Terrain strike anywhere else ends the sortie.
      f.pos.y = groundY + 1.6;
      w.damage = 100;
      sfx.crash();
      endMission(w, 'crashed');
    } else {
      f.pos.y = groundY + 2.2;
    }
  }

  if (wasAirborne && !f.airborne) {
    // Rolled to a stop on the ground without the runway: still a crash if
    // the plane is far from the strip — handled above; this just steadies it.
    f.speed = Math.max(0, f.speed - 30 * dt);
  }

  if (w.damage >= 100) {
    endMission(w, 'crashed');
  }
  if (w.fuel <= 0 && !f.airborne && f.landed) {
    // Sat on the ground out of fuel: the runway crew refuels you.
    w.fuel = CFG.fuel.refill;
    w.warnedFuel = false;
  }

  input.consume();
}
