// player.js — the thief. One clear job: move, sneak, hide, throw, steal.
// The game loop asks it to update; it never draws itself or touches guards.

import { TILE, circleFits, hasLineOfSight, inBush } from './level.js';

export const WALK_SPEED = 175;
export const SNEAK_SPEED = 95;
export const PLAYER_RADIUS = 13;
export const PEBBLE_RANGE = 300;
export const PEBBLE_START_COUNT = 5;

export class Player {
  constructor(start) {
    this.reset(start);
  }

  reset(start) {
    this.x = start.x;
    this.y = start.y;
    this.facing = 0; // radians; 0 faces right
    this.moving = false;
    this.sneaking = false;
    this.hidden = false;
    this.pebbles = PEBBLE_START_COUNT;
    this.shards = 0;
    this.pebble = null; // a pebble in flight: {x, y, tx, ty, t}
    this.stepPhase = 0;
  }

  // One frame of movement. Walls push back axis by axis so the thief
  // slides along them instead of sticking on corners.
  update(dt, input, level) {
    const dir = input.moveDirection();
    this.sneaking = input.sneakHeld;
    this.moving = dir !== null;
    if (dir) {
      const speed = this.sneaking ? SNEAK_SPEED : WALK_SPEED;
      this.facing = Math.atan2(dir.y, dir.x);
      this.tryMove(dir.x * speed * dt, 0, level);
      this.tryMove(0, dir.y * speed * dt, level);
      this.stepPhase += dt * (this.sneaking ? 7 : 11);
    }
    this.hidden = inBush(level, this.x, this.y);

    // A flying pebble arcs to its target, then lands with a clink.
    if (this.pebble) {
      this.pebble.t += dt * 2.2;
      const t = Math.min(1, this.pebble.t);
      this.pebble.x = this.pebble.x0 + (this.pebble.tx - this.pebble.x0) * t;
      this.pebble.y = this.pebble.y0 + (this.pebble.ty - this.pebble.y0) * t;
      if (t >= 1) {
        this.pebble.landed = true;
      }
    }
    return this.pebble && this.pebble.landed ? this.takeLandedPebble() : null;
  }

  tryMove(dx, dy, level) {
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (circleFits(level, nx, ny, PLAYER_RADIUS)) {
      this.x = nx;
      this.y = ny;
    }
  }

  // Throw a pebble at the mouse: only inside range, only with a clear
  // line, only while any are left. Returns true when one leaves the hand.
  throwPebble(target, level) {
    if (this.pebbles <= 0 || this.pebble) return false;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PEBBLE_RANGE || dist < 20) return false;
    if (!hasLineOfSight(level.map, this.x, this.y, target.x, target.y)) return false;
    this.pebbles -= 1;
    this.pebble = {
      x0: this.x, y0: this.y, x: this.x, y: this.y,
      tx: target.x, ty: target.y, t: 0, landed: false,
    };
    return true;
  }

  takeLandedPebble() {
    const landed = { x: this.pebble.tx, y: this.pebble.ty };
    this.pebble = null;
    return landed;
  }

  // Standing on a shard's tile pockets it. Returns the shard or null.
  collectShard(level) {
    for (const shard of level.shards) {
      if (shard.taken) continue;
      const cx = shard.tx * TILE + TILE / 2;
      const cy = shard.ty * TILE + TILE / 2;
      if (Math.hypot(this.x - cx, this.y - cy) < TILE * 0.7) {
        shard.taken = true;
        this.shards += 1;
        return shard;
      }
    }
    return null;
  }

  // At the exit door with every shard pocketed, the night is won.
  atExit(level) {
    if (!level.exit) return false;
    const cx = level.exit.tx * TILE + TILE / 2;
    const cy = level.exit.ty * TILE + TILE / 2;
    return Math.hypot(this.x - cx, this.y - cy) < TILE * 0.8;
  }
}
