// The HUD: big flight numbers, fuel and damage bars, a lit instrument panel
// (artificial horizon, compass strip, throttle) and the mission readout.
// All of it is plain DOM + two small canvases, updated once a frame.
function createHud() {
  const $ = (id) => document.getElementById(id);
  const hud = {
    alt: $('hud-alt'), spd: $('hud-spd'), hdg: $('hud-hdg'),
    fuelBar: $('hud-fuel-bar'), fuelText: $('hud-fuel'),
    dmgBar: $('hud-dmg-bar'), dmgText: $('hud-dmg'),
    score: $('hud-score'), time: $('hud-time'), rings: $('hud-rings'),
    next: $('hud-next'), arrow: $('hud-arrow'),
    toast: $('hud-toast'), banner: $('hud-banner'),
    throttleFill: $('hud-throttle-fill'),
    horizon: $('hud-horizon'), compass: $('hud-compass'),
    title: $('screen-title'), pause: $('screen-pause'), end: $('screen-end'),
    endTitle: $('end-title'), endStats: $('end-stats'),
    cockpit: $('cockpit-frame'),
  };
  hud.horizonCtx = hud.horizon.getContext('2d');
  hud.compassCtx = hud.compass.getContext('2d');
  hud.toastTimer = 0;
  return hud;
}

/** Show one overlay screen (title / pause / end / none) and hide the rest. */
function showScreen(hud, name) {
  hud.title.classList.toggle('hidden', name !== 'title');
  hud.pause.classList.toggle('hidden', name !== 'pause');
  hud.end.classList.toggle('hidden', name !== 'end');
}

/** Flash a short message in the centre of the screen. */
function flashToast(hud, text, seconds) {
  hud.toast.textContent = text;
  hud.toast.classList.remove('hidden');
  hud.toastTimer = seconds || 2.2;
}

function drawHorizon(ctx, pitch, roll) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const shift = pitch * 90;
  ctx.fillStyle = '#2f6fb4';
  ctx.fillRect(-w, -h + shift, w * 2, h);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-w, shift, w * 2, h);
  ctx.strokeStyle = '#f5f5f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w, shift);
  ctx.lineTo(w, shift);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(245,245,240,0.55)';
  ctx.lineWidth = 1;
  for (const dy of [-30, -15, 15, 30]) {
    ctx.beginPath();
    ctx.moveTo(-34, shift + dy);
    ctx.lineTo(34, shift + dy);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed aircraft symbol, glowing amber.
  ctx.strokeStyle = '#ffb02e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 10, cy);
  ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 34, cy);
  ctx.moveTo(cx, cy - 2); ctx.lineTo(cx, cy + 6);
  ctx.stroke();
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawCompass(ctx, headingDeg) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  ctx.fillRect(0, 0, w, h);
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px system-ui, sans-serif';
  const pxPerDeg = w / 120;
  // Step over absolute degrees so labels land on multiples of 15 whatever
  // the heading is (stepping by offsets from the heading skips them).
  const start = Math.floor((headingDeg - 60) / 5) * 5;
  for (let deg = start; deg <= headingDeg + 60; deg += 5) {
    const norm = ((deg % 360) + 360) % 360;
    const x = w / 2 + (deg - headingDeg) * pxPerDeg;
    if (x < -20 || x > w + 20) continue;
    const major = norm % 45 === 0;
    const minor = norm % 15 === 0;
    ctx.strokeStyle = major ? '#ffb02e' : 'rgba(238,241,245,0.6)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, major ? 22 : 16);
    ctx.stroke();
    if (minor) {
      ctx.fillStyle = major ? '#ffb02e' : '#eef1f5';
      ctx.fillText(labels[norm] || String(norm), x, h - 8);
    }
  }
  // Centre lubber line.
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, 0); ctx.lineTo(w / 2 + 6, 0); ctx.lineTo(w / 2, 10); ctx.closePath();
  ctx.fill();
}

/** Refresh every HUD element from the world state. Call once per frame. */
function updateHud(hud, w, dt) {
  const f = w.flight;
  const altitudeFt = Math.max(0, Math.round((f.pos.y - terrainHeight(f.pos.x, f.pos.z)) * 3.281));
  const speedKt = Math.round(f.speed * 1.944);
  const headingDeg = Math.round(((f.heading * 180 / Math.PI) % 360 + 360) % 360);
  hud.alt.textContent = String(altitudeFt).padStart(4, '0');
  hud.spd.textContent = String(speedKt).padStart(3, '0');
  hud.hdg.textContent = String(headingDeg).padStart(3, '0');
  hud.fuelText.textContent = Math.max(0, Math.round(w.fuel)) + '%';
  hud.fuelBar.style.width = Math.max(0, w.fuel) + '%';
  hud.fuelBar.classList.toggle('low', w.fuel < 25);
  hud.dmgText.textContent = Math.round(w.damage) + '%';
  hud.dmgBar.style.width = Math.min(100, w.damage) + '%';
  hud.score.textContent = String(w.score);
  hud.time.textContent = formatTime(w.time);
  hud.rings.textContent = w.ringsPassed + ' / ' + CFG.mission.rings;
  hud.throttleFill.style.height = Math.round(f.throttle * 100) + '%';

  const next = w.rings.find((r) => !r.passed);
  if (next) {
    const dx = next.pos.x - f.pos.x, dz = next.pos.z - f.pos.z;
    const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
    const bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const rel = ((bearing - headingDeg + 540) % 360) - 180;
    hud.next.textContent = 'RING ' + (w.ringsPassed + 1) + ' — ' + dist + ' m';
    hud.arrow.style.transform = 'rotate(' + rel + 'deg)';
    hud.arrow.classList.remove('hidden');
  } else {
    hud.next.textContent = 'ALL RINGS CLEAR';
    hud.arrow.classList.add('hidden');
  }
  hud.banner.textContent = w.banner;

  drawHorizon(hud.horizonCtx, f.pitch, f.roll);
  drawCompass(hud.compassCtx, headingDeg);

  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) hud.toast.classList.add('hidden');
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
