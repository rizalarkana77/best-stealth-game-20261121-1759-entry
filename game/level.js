// level.js — the Emberwick Vault floor plan and all tile / sight maths.
// One clear job: know the map. Nothing here draws, moves or sounds.

// The vault hall, seen from above. 32 columns x 20 rows, '#' is a wall,
// '.' is open floor, 'C' a display crate (cover: blocks feet and sight),
// 'B' a hedge bush (hide inside it), 'S' an Ember Shard, 'E' the exit,
// 'P' where the thief slips in. Every row is exactly 32 characters.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;

export const LEVEL_MAP = [
  '################################',
  '#P.............................#',
  '#......C..........C............#',
  '#..........................S...#',
  '#..#####..........#####........#',
  '#..#####..........#####....B...#',
  '#..#####....C.....#####........#',
  '#..#####..........#####........#',
  '#..............................#',
  '#....C..........B.....S....C...#',
  '#..............................#',
  '#..B.......#####......#####....#',
  '#..........#####......#####....#',
  '#....C.....#####..S...#####....#',
  '#..........#####......#####....#',
  '#..........................E...#',
  '#......C..........C............#',
  '#..B...........................#',
  '#..............................#',
  '################################',
];

// Where the guards walk their rounds, in tile coordinates. Each list is a
// loop of open-floor tiles; a guard walks it in order, pausing at corners.
export const GUARD_PATROLS = [
  { name: 'Bram', color: '#e8b13c', waypoints: [[10, 2], [24, 2], [24, 6], [10, 6]] },
  { name: 'Mira', color: '#e87a3c', waypoints: [[6, 10], [16, 10], [16, 12], [6, 12]] },
  { name: 'Odo', color: '#c65a8a', waypoints: [[28, 8], [28, 16], [24, 16], [24, 8]] },
  { name: 'Sable', color: '#7a9be8', waypoints: [[4, 16], [14, 18], [14, 16], [4, 18]] },
];

// Hanging lamps: pools of warm light that mark the lit (dangerous) floor.
export const LAMP_TILES = [[8, 2], [24, 8], [12, 16], [27, 12], [16, 4]];

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function tileAt(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return map[ty][tx];
}

// A wall or a crate stops the thief's feet.
export function isSolidTile(map, tx, ty) {
  const t = tileAt(map, tx, ty);
  return t === '#' || t === 'C';
}

// A wall or a crate stops a guard's eyes. Bushes do not.
export function blocksSightTile(map, tx, ty) {
  const t = tileAt(map, tx, ty);
  return t === '#' || t === 'C';
}

// Walk the straight segment in small steps; any solid tile on the way
// breaks the line of sight. Used for vision cones and pebble throws.
export function hasLineOfSight(map, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (blocksSightTile(map, tx, ty)) return false;
  }
  return true;
}

// Read the map once into sets the rest of the game queries.
export function parseLevel(map = LEVEL_MAP) {
  const walls = new Set();
  const crates = new Set();
  const bushes = new Set();
  const shards = [];
  let exit = null;
  let playerStart = null;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = map[y][x];
      const key = x + ',' + y;
      if (t === '#') walls.add(key);
      else if (t === 'C') crates.add(key);
      else if (t === 'B') bushes.add(key);
      else if (t === 'S') shards.push({ tx: x, ty: y, taken: false });
      else if (t === 'E') exit = { tx: x, ty: y };
      else if (t === 'P') playerStart = { tx: x, ty: y };
    }
  }
  return {
    map,
    walls,
    crates,
    bushes,
    shards,
    exit,
    playerStart,
    lamps: LAMP_TILES.map(([tx, ty]) => tileCenter(tx, ty)),
  };
}

// Is this pixel inside a bush tile? Standing in a hedge hides the thief
// unless a guard is almost on top of them.
export function inBush(level, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return level.bushes.has(tx + ',' + ty);
}

// Can a circle of radius r sit at (x, y) without touching a solid tile?
export function circleFits(level, x, y, r) {
  const minTx = Math.floor((x - r) / TILE);
  const maxTx = Math.floor((x + r) / TILE);
  const minTy = Math.floor((y - r) / TILE);
  const maxTy = Math.floor((y + r) / TILE);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isSolidTile(level.map, tx, ty)) continue;
      const nearestX = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const nearestY = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < r * r) return false;
    }
  }
  return true;
}
