// Skyline Courier — tuning numbers and colours in one place.
// The world is a 4000 x 4000 m valley. The playfield is the valley floor
// and the mountains that rim it; nothing below depends on the screen size.
const CFG = {
  world: { size: 4000, half: 2000, mountainRim: 1500, mountainHeight: 320 },
  runway: { x: 0, z: 900, length: 420, width: 36, heading: 0 },
  plane: {
    minSpeed: 24, maxSpeed: 82, cruiseSpeed: 52,
    climbRate: 0.9, rollRate: 1.15, pitchRate: 0.8,
    turnFactor: 0.85, stallSpeed: 26, sinkRate: 9,
    startAltitude: 46,
  },
  fuel: { start: 100, drainBase: 0.30, drainThrottle: 0.75, ringBonus: 6, refill: 100 },
  mission: { rings: 6, ringRadius: 26, ringScore: 100, landingBonus: 150 },
  damage: { crash: 100, graze: 18, hardLanding: 25, repairOnLand: 100 },
  camera: { chaseDistance: 22, chaseHeight: 3.4, cockpitOffset: 1.6 },
  colours: {
    sky: 0x87b5e0, fog: 0xa8c4de, sun: 0xfff2d8,
    grassLow: 0x5d8a46, grassHigh: 0x7fae5a, rock: 0x8a8378, snow: 0xf2f5f7,
    river: 0x3f7fc4, sand: 0xcbb98a, runway: 0x3a3f46, runwayMark: 0xf5f5f0,
    townRoof: 0xb5503c, townWall: 0xe8ddc8, treeTrunk: 0x6b4a2f, treeTop: 0x2f6b34,
    planeBody: 0xf2ead8, planeTrim: 0xc23b2e, planeGlass: 0x1d3a4d,
    ringNext: 0xff9a1f, ringDone: 0x37d67a, ringFar: 0xff5a3c,
  },
};

/** Fixed-step simulation rate: 60 updates a second whatever the display does. */
const STEP = 1 / 60;

/** localStorage key for the best score (this browser only). */
const BEST_KEY = 'skyline-courier.best';
