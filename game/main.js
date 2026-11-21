// main.js — the game itself: state, loop, rules, and the staged scenes the
// screenshots are taken from. One clear job: run the night. It wires the
// level, the thief, the guards, the sounds and the renderer together.

import { TILE, GUARD_PATROLS, parseLevel, tileCenter } from './level.js';
import { Guard } from './guard.js';
import { Player } from './player.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { drawGame, VIEW_W, VIEW_H } from './render.js';

const SHOT_SCENES = ['cover', 'patrol', 'alarm', 'exit'];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sounds = new SoundBank();
    this.input = new Input(canvas);
    this.level = parseLevel();
    const start = tileCenter(this.level.playerStart.tx, this.level.playerStart.ty);
    this.player = new Player(start);
    this.guards = GUARD_PATROLS.map((def) => new Guard(def));
    this.state = 'title'; // title | playing | won | lost
    this.time = 0;
    this.alerts = 0;
    this.alarmFlash = 0;
    this.winTime = '';
    this.mouseInside = false;
    this.showRange = false;
    this.objective = 'Find the 3 Ember Shards';
    this.lastFrame = performance.now();
    this.shot = new URLSearchParams(window.location.search).get('shot');
  }

  reset() {
    this.level = parseLevel();
    const start = tileCenter(this.level.playerStart.tx, this.level.playerStart.ty);
    this.player.reset(start);
    for (const guard of this.guards) guard.reset();
    this.state = 'playing';
    this.time = 0;
    this.alerts = 0;
    this.alarmFlash = 0;
    this.objective = 'Find the 3 Ember Shards';
    this.input.clearPressed();
  }

  start() {
    this.sounds.ensure();
    if (SHOT_SCENES.includes(this.shot)) {
      this.stageShot(this.shot);
      drawGame(this.ctx, this);
      return; // staged scenes are frozen frames for the screenshots
    }
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.update(dt);
      drawGame(this.ctx, this);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    this.mouseInside = this.input.mouse.inside;
    if (this.state === 'title') {
      if (this.input.wasPressed('Enter') || this.input.takeClick()) {
        this.sounds.ensure();
        this.reset();
      }
      return;
    }
    if (this.state === 'won' || this.state === 'lost') {
      if (this.input.wasPressed('Enter')) this.reset();
      return;
    }

    this.time += dt;
    if (this.alarmFlash > 0) this.alarmFlash -= dt;
    if (this.input.wasPressed('KeyM')) this.sounds.toggleMute();

    // The thief moves first; a pebble landing is a noise the guards hear.
    const landed = this.player.update(dt, this.input, this.level);
    if (landed) {
      this.sounds.pebbleClink();
      let nearest = null;
      let best = Infinity;
      for (const guard of this.guards) {
        const d = Math.hypot(guard.x - landed.x, guard.y - landed.y);
        if (d < best) {
          best = d;
          nearest = guard;
        }
      }
      if (nearest) nearest.hearNoise(landed.x, landed.y);
    }

    const click = this.input.takeClick();
    if (click) {
      this.sounds.ensure();
      if (this.player.throwPebble(click, this.level)) this.sounds.pebbleClink();
    }
    this.showRange = this.player.pebbles > 0;

    if (this.player.moving) this.sounds.footstep(this.player.sneaking);

    // A shard on the thief's tile is pocketed.
    const shard = this.player.collectShard(this.level);
    if (shard) {
      this.sounds.pickup();
      if (this.player.shards >= this.level.shards.length) {
        this.objective = 'All shards taken — reach the EXIT!';
        this.sounds.doorOpens();
      }
    }

    // The guards watch, suspect, chase — and catch.
    for (const guard of this.guards) {
      guard.update(
        dt,
        this.player,
        this.level,
        (g) => this.onSpotted(g),
        (g, dist) => this.sounds.guardStep(dist),
      );
      if (guard.catches(this.player)) {
        this.state = 'lost';
        this.sounds.lose();
        return;
      }
    }

    // The exit only opens with every shard pocketed.
    if (this.player.shards >= this.level.shards.length && this.player.atExit(this.level)) {
      this.state = 'won';
      const mins = Math.floor(this.time / 60);
      const secs = Math.floor(this.time % 60).toString().padStart(2, '0');
      this.winTime = `${mins}:${secs}`;
      this.sounds.win();
    }
  }

  onSpotted(guard) {
    this.alerts += 1;
    this.alarmFlash = 1.2;
    this.sounds.spotted();
  }

  // Staged scenes for the screenshots (?shot=cover|patrol|alarm|exit):
  // fixed poses of the real game state, rendered once, never edited.
  stageShot(name) {
    this.reset();
    const at = (tx, ty) => tileCenter(tx, ty);
    const guardAt = (i, tx, ty, facing) => {
      const g = this.guards[i];
      const p = at(tx, ty);
      g.x = p.x;
      g.y = p.y;
      g.facing = facing;
      g.state = 'patrol';
    };
    const placePlayer = (tx, ty, facing) => {
      const p = at(tx, ty);
      this.player.x = p.x;
      this.player.y = p.y;
      this.player.facing = facing;
    };
    const takeShard = (i) => {
      this.level.shards[i].taken = true;
      this.player.shards += 1;
    };

    if (name === 'cover') {
      // The whole game at a glance: cones sweeping, cover everywhere,
      // the thief mid-route with one shard already pocketed.
      placePlayer(14, 9, 0);
      takeShard(0);
      this.time = 47;
      guardAt(0, 16, 2, Math.PI);
      guardAt(1, 10, 10, 0);
      guardAt(2, 28, 12, -Math.PI / 2);
      guardAt(3, 8, 16, Math.PI / 2);
    } else if (name === 'patrol') {
      // The opening sneak: the thief crouched behind a plinth as a guard's
      // cone sweeps past, suspicion just starting to rise.
      placePlayer(6, 3, Math.PI / 2);
      this.player.sneaking = true;
      this.time = 12;
      guardAt(0, 12, 2, Math.PI);
      this.guards[0].suspicion = 0.32;
      guardAt(1, 10, 10, 0);
      guardAt(2, 26, 10, Math.PI);
      guardAt(3, 8, 18, 0);
    } else if (name === 'alarm') {
      // The near miss: spotted in a lit lane, the guard closing in with a
      // red cone while the thief runs for the hedge.
      placePlayer(20, 8, Math.PI / 2);
      takeShard(0);
      takeShard(2);
      this.time = 96;
      this.alerts = 1;
      this.alarmFlash = 0.9;
      guardAt(0, 22, 10, -Math.PI / 2);
      this.guards[0].state = 'chase';
      this.guards[0].suspicion = 1;
      this.guards[0].alarmed = true;
      this.guards[0].lastSeen = { x: this.player.x, y: this.player.y };
      guardAt(1, 12, 10, Math.PI / 2);
      this.guards[1].suspicion = 0.6;
      guardAt(2, 28, 12, -Math.PI / 2);
      guardAt(3, 8, 16, 0);
    } else if (name === 'exit') {
      // The endgame: all three shards pocketed, the exit glowing green,
      // one last cone crossing the escape route.
      placePlayer(24, 15, 0);
      takeShard(0);
      takeShard(1);
      takeShard(2);
      this.time = 168;
      this.objective = 'All shards taken — reach the EXIT!';
      guardAt(0, 16, 2, Math.PI);
      guardAt(1, 18, 12, Math.PI / 2);
      guardAt(2, 28, 11, Math.PI);
      guardAt(3, 10, 18, -Math.PI / 2);
    }
    this.state = 'playing';
  }
}

// Boot: the canvas is the whole game; the page around it is just a frame.
const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const game = new Game(canvas);
window.__game = game; // for play-testing from the console
game.start();
