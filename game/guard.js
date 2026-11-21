// guard.js — the vault's night watch. One clear job: see, suspect, chase.
// A guard patrols its loop, watches a cone of floor, grows suspicious when
// the thief crosses its sight, chases when sure, and gives up — with a
// recovery chance for the player — when the trail goes cold.

import { TILE, hasLineOfSight, tileCenter } from './level.js';

export const VISION_RANGE = 235;
export const VISION_HALF_ANGLE = 0.55; // radians either side of facing
export const PATROL_SPEED = 72;
export const CHASE_SPEED = 152;
export const INVESTIGATE_SPEED = 105;
export const CATCH_DISTANCE = 30;
export const BUSH_SPOT_DISTANCE = 62; // a guard must be this close to see into a hedge

// How fast suspicion fills while the thief is seen, and drains unseen.
const SUSPICION_GAIN_WALK = 1.5;
const SUSPICION_GAIN_SNEAK = 0.65;
const SUSPICION_GAIN_HIDDEN = 0.25;
const SUSPICION_DRAIN = 0.28;
const ALARM_CALM_SECONDS = 4; // unseen this long and the hunt cools off

export class Guard {
  constructor(def) {
    this.name = def.name;
    this.color = def.color;
    this.waypoints = def.waypoints.map(([tx, ty]) => tileCenter(tx, ty));
    this.waypointIndex = 0;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.facing = 0;
    this.state = 'patrol'; // patrol | investigate | chase | return
    this.suspicion = 0;
    this.lastSeen = null; // {x, y} where the thief was last spotted
    this.unseenFor = 0;
    this.pauseTimer = 0;
    this.lookTimer = 0;
    this.stepTimer = 0;
    this.moving = false;
    this.alarmed = false;
  }

  reset() {
    this.waypointIndex = 0;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.facing = 0;
    this.state = 'patrol';
    this.suspicion = 0;
    this.lastSeen = null;
    this.unseenFor = 0;
    this.pauseTimer = 0;
    this.alarmed = false;
  }

  // Can this guard see the thief right now? Distance, cone, a clear line,
  // and the hedge rule: a hidden thief is invisible unless the guard is
  // almost on top of them.
  canSee(player, level) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > VISION_RANGE) return false;
    if (player.hidden && dist > BUSH_SPOT_DISTANCE) return false;
    let angleDiff = Math.atan2(dy, dx) - this.facing;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    if (Math.abs(angleDiff) > VISION_HALF_ANGLE) return false;
    return hasLineOfSight(level.map, this.x, this.y, player.x, player.y);
  }

  // A noise at (x, y) draws the nearest guard to go and look.
  hearNoise(x, y) {
    if (this.state === 'chase') return;
    const dist = Math.hypot(x - this.x, y - this.y);
    if (dist > 260) return;
    this.state = 'investigate';
    this.lastSeen = { x, y };
    this.lookTimer = 0;
  }

  update(dt, player, level, onSpotted, onFootstep) {
    const sees = this.canSee(player, level);
    if (sees) {
      this.lastSeen = { x: player.x, y: player.y };
      this.unseenFor = 0;
      const gain = player.hidden
        ? SUSPICION_GAIN_HIDDEN
        : player.sneaking
          ? SUSPICION_GAIN_SNEAK
          : SUSPICION_GAIN_WALK;
      this.suspicion = Math.min(1, this.suspicion + gain * dt);
      if (this.suspicion >= 1 && this.state !== 'chase') {
        this.state = 'chase';
        this.alarmed = true;
        onSpotted(this);
      }
    } else {
      this.unseenFor += dt;
      this.suspicion = Math.max(0, this.suspicion - SUSPICION_DRAIN * dt);
    }

    this.moving = false;
    if (this.state === 'patrol') this.patrol(dt);
    else if (this.state === 'chase') this.chase(dt, player);
    else if (this.state === 'investigate') this.investigate(dt);
    else this.returnToPatrol(dt);

    // The hunt cools off: unseen long enough and the guard stands down.
    if (this.state === 'chase' && !sees && this.unseenFor > ALARM_CALM_SECONDS) {
      this.state = 'return';
      this.alarmed = false;
    }

    // Footsteps, paced by speed, so the player hears a guard coming.
    if (this.moving) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.state === 'chase' ? 0.32 : 0.55;
        onFootstep(this, Math.hypot(player.x - this.x, player.y - this.y));
      }
    }
  }

  patrol(dt) {
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      return;
    }
    const target = this.waypoints[this.waypointIndex];
    if (this.walkToward(target, PATROL_SPEED, dt)) {
      this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
      this.pauseTimer = 0.9; // a beat at each corner, to look around
    }
  }

  chase(dt, player) {
    const target = this.lastSeen || { x: player.x, y: player.y };
    this.walkToward(target, CHASE_SPEED, dt);
  }

  investigate(dt) {
    const target = this.lastSeen;
    if (!target) {
      this.state = 'return';
      return;
    }
    if (this.walkToward(target, INVESTIGATE_SPEED, dt)) {
      // Arrived and found nothing: look around, then go back to rounds.
      this.lookTimer += dt;
      this.facing += dt * 1.8;
      if (this.lookTimer > 2.2) {
        this.state = 'return';
        this.lookTimer = 0;
      }
    }
  }

  returnToPatrol(dt) {
    let nearest = this.waypoints[0];
    let best = Infinity;
    for (const wp of this.waypoints) {
      const d = (wp.x - this.x) ** 2 + (wp.y - this.y) ** 2;
      if (d < best) {
        best = d;
        nearest = wp;
      }
    }
    if (this.walkToward(nearest, PATROL_SPEED, dt)) {
      this.waypointIndex = this.waypoints.indexOf(nearest);
      this.state = 'patrol';
    }
  }

  // Walk toward a point at a speed; returns true on arrival. Facing
  // follows the walk, so the vision cone sweeps where the guard goes.
  walkToward(target, speed, dt) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const step = Math.min(dist, speed * dt);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.facing = Math.atan2(dy, dx);
    this.moving = true;
    return step >= dist - 0.01;
  }

  // Close enough to grab the thief while the alarm is up: caught.
  catches(player) {
    return this.state === 'chase'
      && Math.hypot(player.x - this.x, player.y - this.y) < CATCH_DISTANCE;
  }
}
