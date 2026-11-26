// Small deterministic random helpers. The terrain, town and ring layout all
// derive from one seed, so ?seed=N always builds the same valley.

/** Mulberry32: a tiny seeded PRNG returning floats in [0, 1). */
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 2D hash in [0, 1) for a lattice point; stable across runs. */
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 100000) / 100000;
}

/** Smooth interpolation between a and b. */
function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Value noise: bilinear interpolation of the lattice hash, in [0, 1). */
function noise2(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx), v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise: three octaves of value noise, in roughly [0, 1]. */
function fbm2(x, z, seed) {
  return (
    noise2(x, z, seed) * 0.55 +
    noise2(x * 2.13, z * 2.13, seed + 7) * 0.3 +
    noise2(x * 4.31, z * 4.31, seed + 13) * 0.15
  );
}
