// Every tuning number Port Solara shares between systems: the city grid, speeds, combat and police.
// The city is an island laid out on a road grid: road centre lines sit every PITCH metres, blocks fill
// the squares between them, the ocean wraps the south, east and west shores and hills close the north.

export const STEP = 1 / 60;

export const CITY = {
  cols: 10,
  rows: 8,
  pitch: 70,
  road: 14,
  sidewalk: 4,
  laneOffset: 3.4,
  originX: -350,
  originZ: -300,
  beachDepth: 64,
  quayDepth: 46,
  westShore: 40,
  northHills: 60,
};

CITY.block = CITY.pitch - CITY.road;
CITY.minX = CITY.originX;
CITY.maxX = CITY.originX + CITY.cols * CITY.pitch;
CITY.minZ = CITY.originZ;
CITY.maxZ = CITY.originZ + CITY.rows * CITY.pitch;
CITY.bounds = {
  minX: CITY.minX - CITY.westShore,
  maxX: CITY.maxX + CITY.quayDepth,
  minZ: CITY.minZ - CITY.northHills,
  maxZ: CITY.maxZ + CITY.beachDepth,
};

export const PLAYER = {
  radius: 0.42,
  walkSpeed: 3.2,
  sprintSpeed: 7.2,
  accel: 22,
  maxHealth: 100,
  maxArmor: 100,
  enterRange: 3.6,
  jumpSpeed: 5.2,
  gravity: 16,
};

export const PED = {
  walkSpeed: 1.35,
  runSpeed: 5.6,
  radius: 0.38,
  health: 40,
  count: 46,
  spawnRadius: 120,
  despawnRadius: 150,
};

export const TRAFFIC = {
  count: 26,
  cruiseSpeed: 12.5,
  spawnMin: 70,
  spawnMax: 170,
  despawnRadius: 210,
};

export const COMBAT = {
  punchRange: 1.6,
  punchDamage: 14,
  punchCooldown: 0.45,
  pistolDamage: 34,
  pistolRange: 90,
  pistolCooldown: 0.28,
  clipSize: 12,
  reloadTime: 1.3,
};

export const WANTED = {
  maxStars: 5,
  sightRange: 85,
  // Seconds out of sight needed to shake the police, by star count.
  evadeSeconds: [0, 6, 9, 12, 15, 18],
  // Radius of the search area around the last place the police saw the player.
  searchRadius: [0, 70, 90, 110, 130, 150],
  heatPerStar: 100,
};

export const POLICE = {
  unitsByStars: [0, 1, 2, 3, 4, 5],
  spawnMin: 80,
  spawnMax: 150,
  despawnRadius: 240,
  arrestRange: 2.2,
  arrestSeconds: 2.2,
  shootRange: 32,
  shootDamage: 7,
};

export const CAMERA = {
  footDistance: 4.6,
  footHeight: 1.75,
  carDistance: 8.5,
  carHeight: 3.0,
  fov: 62,
};
