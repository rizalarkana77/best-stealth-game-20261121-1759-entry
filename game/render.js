// render.js — everything the eye sees, and nothing else. The game hands it
// the whole state; it draws the hall, the cones, the thief, the light and
// the HUD onto one canvas, in that order.

import { TILE, COLS, ROWS, blocksSightTile } from './level.js';
import { VISION_RANGE, VISION_HALF_ANGLE } from './guard.js';

export const VIEW_W = 1280;
export const VIEW_H = 800;

// A pre-painted floor: stone tiles with a faint checker and speckle, drawn
// once and blitted every frame instead of re-painting 640 tiles.
let floorCanvas = null;
function floorPattern() {
  if (floorCanvas) return floorCanvas;
  floorCanvas = document.createElement('canvas');
  floorCanvas.width = VIEW_W;
  floorCanvas.height = VIEW_H;
  const c = floorCanvas.getContext('2d');
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const even = (tx + ty) % 2 === 0;
      c.fillStyle = even ? '#2b2f3a' : '#272b35';
      c.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      c.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE, TILE);
    }
  }
  // Speckle: a little worn stone, seeded so it never changes.
  let seed = 12345;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 900; i++) {
    c.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    c.fillRect(Math.floor(rand() * VIEW_W), Math.floor(rand() * VIEW_H), 2, 2);
  }
  return floorCanvas;
}

// A vision cone clipped by walls: fan out rays, stop each at the first
// solid tile, join the ends. The cone shows exactly what the guard sees.
function conePolygon(level, guard) {
  const rays = 22;
  const points = [];
  for (let i = 0; i <= rays; i++) {
    const angle = guard.facing - VISION_HALF_ANGLE
      + (2 * VISION_HALF_ANGLE * i) / rays;
    let reach = VISION_RANGE;
    for (let d = 12; d <= VISION_RANGE; d += 10) {
      const x = guard.x + Math.cos(angle) * d;
      const y = guard.y + Math.sin(angle) * d;
      if (blocksSightTile(level.map, Math.floor(x / TILE), Math.floor(y / TILE))) {
        reach = d - 10;
        break;
      }
    }
    points.push({
      x: guard.x + Math.cos(angle) * Math.max(10, reach),
      y: guard.y + Math.sin(angle) * Math.max(10, reach),
    });
  }
  return points;
}

let lightCanvas = null;
function lightLayer() {
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = VIEW_W;
    lightCanvas.height = VIEW_H;
  }
  return lightCanvas;
}

// The night itself: a dark sheet with holes of warm light cut around the
// thief, the lamps, the shards and the exit — lighting shows what is safe.
function drawLighting(ctx, game) {
  const light = lightLayer();
  const lc = light.getContext('2d');
  lc.clearRect(0, 0, VIEW_W, VIEW_H);
  lc.globalCompositeOperation = 'source-over';
  lc.fillStyle = 'rgba(5, 7, 18, 0.62)';
  lc.fillRect(0, 0, VIEW_W, VIEW_H);
  lc.globalCompositeOperation = 'destination-out';
  const hole = (x, y, radius, strength) => {
    const g = lc.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = g;
    lc.beginPath();
    lc.arc(x, y, radius, 0, Math.PI * 2);
    lc.fill();
  };
  hole(game.player.x, game.player.y, 190, 0.95);
  for (const lamp of game.level.lamps) hole(lamp.x, lamp.y, 150, 0.75);
  for (const shard of game.level.shards) {
    if (!shard.taken) hole(shard.tx * TILE + TILE / 2, shard.ty * TILE + TILE / 2, 70, 0.6);
  }
  if (game.level.exit) {
    const ex = game.level.exit;
    hole(ex.tx * TILE + TILE / 2, ex.ty * TILE + TILE / 2, 90, 0.7);
  }
  ctx.drawImage(light, 0, 0);
}

function drawWorld(ctx, game) {
  const { level } = game;
  ctx.drawImage(floorPattern(), 0, 0);

  // Walls: raised stone with a lit top edge.
  ctx.fillStyle = '#454b5c';
  ctx.strokeStyle = '#14161d';
  for (const key of level.walls) {
    const [tx, ty] = key.split(',').map(Number);
    ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE, TILE);
    ctx.fillStyle = '#5a6274';
    ctx.fillRect(tx * TILE, ty * TILE, TILE, 5);
    ctx.fillStyle = '#454b5c';
  }

  // Crates: wooden display plinths you can crouch behind.
  for (const key of level.crates) {
    const [tx, ty] = key.split(',').map(Number);
    const x = tx * TILE;
    const y = ty * TILE;
    ctx.fillStyle = '#7a5a33';
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.strokeStyle = '#4a3419';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + TILE - 3, y + TILE - 3);
    ctx.moveTo(x + TILE - 3, y + 3);
    ctx.lineTo(x + 3, y + TILE - 3);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Bushes: hedges to hide in, drawn as clustered leaves.
  for (const key of level.bushes) {
    const [tx, ty] = key.split(',').map(Number);
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    ctx.fillStyle = '#2e5d33';
    for (const [ox, oy, r] of [[-9, -6, 13], [9, -7, 12], [0, 8, 13], [-8, 7, 10], [9, 8, 10]]) {
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3f7a44';
    for (const [ox, oy, r] of [[-6, -9, 7], [7, -4, 6], [-2, 5, 7]]) {
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Lamps: brass posts with a warm pool of light on the floor.
  for (const lamp of level.lamps) {
    const glow = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 90);
    glow.addColorStop(0, 'rgba(255, 196, 90, 0.30)');
    glow.addColorStop(1, 'rgba(255, 196, 90, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9973f';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ember Shards: the prize, glowing and bobbing on their plinths.
  const bob = Math.sin(game.time * 3) * 3;
  for (const shard of level.shards) {
    if (shard.taken) continue;
    const cx = shard.tx * TILE + TILE / 2;
    const cy = shard.ty * TILE + TILE / 2 + bob;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 42);
    glow.addColorStop(0, 'rgba(255, 120, 60, 0.55)');
    glow.addColorStop(1, 'rgba(255, 120, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff7a3c';
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 13);
    ctx.lineTo(cx + 9, cy);
    ctx.lineTo(cx, cy + 13);
    ctx.lineTo(cx - 9, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // The exit: a green door, shut and grey until every shard is pocketed.
  if (level.exit) {
    const ex = level.exit;
    const cx = ex.tx * TILE + TILE / 2;
    const cy = ex.ty * TILE + TILE / 2;
    const open = game.player.shards >= level.shards.length;
    ctx.fillStyle = open ? '#1f7a44' : '#3a3f4a';
    ctx.fillRect(cx - 16, cy - 16, 32, 32);
    ctx.strokeStyle = open ? '#7dffb0' : '#6a7080';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 16, cy - 16, 32, 32);
    ctx.lineWidth = 1;
    ctx.fillStyle = open ? '#b8ffd4' : '#9aa0b0';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : 'LOCK', cx, cy);
    if (open) {
      const pulse = 0.5 + 0.3 * Math.sin(game.time * 4);
      ctx.strokeStyle = `rgba(125, 255, 176, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 20, cy - 20, 40, 40);
      ctx.lineWidth = 1;
    }
  }
}

function drawCones(ctx, game) {
  for (const guard of game.guards) {
    const points = conePolygon(game.level, guard);
    const hot = guard.state === 'chase' || guard.suspicion > 0.55;
    const warm = guard.suspicion > 0.2;
    const fill = hot
      ? 'rgba(255, 60, 50, 0.34)'
      : warm
        ? 'rgba(255, 170, 60, 0.28)'
        : 'rgba(255, 214, 90, 0.20)';
    const edge = hot
      ? 'rgba(255, 90, 70, 0.55)'
      : 'rgba(255, 220, 120, 0.45)';
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function drawGuards(ctx, game) {
  for (const guard of game.guards) {
    // Body: a watchman in a coloured tabard, facing where he looks.
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = guard.color;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    // Nose: a short tick in the facing direction.
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(guard.facing) * 11, guard.y + Math.sin(guard.facing) * 11);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 18, guard.y + Math.sin(guard.facing) * 18);
    ctx.stroke();
    ctx.lineWidth = 1;
    // Name and suspicion: a small tag that fills as the guard grows sure.
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(guard.name, guard.x, guard.y - 20);
    if (guard.suspicion > 0.05) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(guard.x - 16, guard.y - 18, 32, 5);
      ctx.fillStyle = guard.suspicion > 0.55 ? '#ff5040' : '#ffb13c';
      ctx.fillRect(guard.x - 15, guard.y - 17, 30 * guard.suspicion, 3);
    }
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  const crouch = p.sneaking ? 0.82 : 1;
  const bob = p.moving ? Math.sin(p.stepPhase) * 1.5 : 0;
  // Cloak shadow, then the hooded thief, smaller and lower when sneaking.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 10, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d6b8e';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, 13 * crouch, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#274b66';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.facing) * 5, p.y + Math.sin(p.facing) * 5 + bob, 7 * crouch, 0, Math.PI * 2);
  ctx.fill();
  // Eyes: two pale dots looking where the thief faces.
  const ex = Math.cos(p.facing + Math.PI / 2) * 3;
  const ey = Math.sin(p.facing + Math.PI / 2) * 3;
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.facing) * 8 + ex, p.y + Math.sin(p.facing) * 8 + ey + bob, 1.6, 0, Math.PI * 2);
  ctx.arc(p.x + Math.cos(p.facing) * 8 - ex, p.y + Math.sin(p.facing) * 8 - ey + bob, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // "HIDDEN" tag while tucked in a hedge.
  if (p.hidden) {
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8dff9e';
    ctx.fillText('HIDDEN', p.x, p.y - 22);
  }
  // A pebble in flight.
  if (p.pebble) {
    ctx.fillStyle = '#cfd6e4';
    ctx.beginPath();
    ctx.arc(p.pebble.x, p.pebble.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Throw range hint: a faint circle around the thief while the mouse is near.
  if (game.showRange && game.mouseInside) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 300, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawHud(ctx, game) {
  const { player, level } = game;
  // Top bar.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, 52);
  ctx.fillStyle = '#e8ecf4';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('EMBERWICK VAULT', 16, 27);
  // Shards.
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#ffb13c';
  ctx.fillText(`◆ ${player.shards}/${level.shards.length} Ember Shards`, 230, 27);
  // Alert meter: the loudest suspicion among the guards.
  const alert = Math.max(0, ...game.guards.map((g) => g.suspicion));
  const anyChase = game.guards.some((g) => g.state === 'chase');
  ctx.fillStyle = '#e8ecf4';
  ctx.fillText(anyChase ? 'ALARM!' : 'ALERT', 430, 27);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(500, 18, 150, 16);
  ctx.fillStyle = anyChase ? '#ff4030' : alert > 0.55 ? '#ff8030' : '#ffcf4d';
  ctx.fillRect(501, 19, 148 * alert, 14);
  // Pebbles and timer.
  ctx.fillStyle = '#e8ecf4';
  ctx.fillText(`● Pebbles ${player.pebbles}`, 680, 27);
  const mins = Math.floor(game.time / 60);
  const secs = Math.floor(game.time % 60).toString().padStart(2, '0');
  ctx.fillText(`⏱ ${mins}:${secs}`, 830, 27);
  ctx.fillStyle = '#9fb4d8';
  ctx.fillText(game.objective, 950, 27);

  // Bottom hint line.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
  ctx.fillRect(0, VIEW_H - 30, VIEW_W, 30);
  ctx.fillStyle = '#b9c4d8';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'WASD / arrows — move    Shift — sneak    Click — throw a pebble (lures guards)    M — mute',
    VIEW_W / 2,
    VIEW_H - 15,
  );
  ctx.textAlign = 'left';
}

function drawBanner(ctx, title, subtitle, color) {
  ctx.fillStyle = 'rgba(5, 7, 14, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = color;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 40);
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '20px sans-serif';
  ctx.fillText(subtitle, VIEW_W / 2, VIEW_H / 2 + 22);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#9fb4d8';
  ctx.fillText('Press Enter to play again', VIEW_W / 2, VIEW_H / 2 + 62);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(5, 7, 14, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffb13c';
  ctx.font = 'bold 58px sans-serif';
  ctx.fillText('EMBERWICK VAULT', VIEW_W / 2, 190);
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '22px sans-serif';
  ctx.fillText('A lantern-thief stealth game', VIEW_W / 2, 245);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#c6d0e2';
  const lines = [
    'Slip into the vault after dark. Pocket all 3 Ember Shards, then reach the green EXIT unseen.',
    'Guards patrol with lanterns and vision cones — cross a cone and their suspicion fills.',
    'Break line of sight and it drains again; hide in the hedges, sneak with Shift,',
    'and throw pebbles with a click to lure a guard away from your route.',
    'If a guard catches you while the alarm is up, the night is over.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 320 + i * 28));
  ctx.fillStyle = '#ffcf4d';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText('Click or press Enter to begin', VIEW_W / 2, 520);
  ctx.textAlign = 'left';
}

// The one entry point the game loop calls: draw the frame for this state.
export function drawGame(ctx, game) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawWorld(ctx, game);
  drawGuards(ctx, game);
  drawPlayer(ctx, game);
  drawLighting(ctx, game);
  drawCones(ctx, game);
  drawHud(ctx, game);

  // A red flash across the top when the alarm first trips.
  if (game.alarmFlash > 0) {
    ctx.fillStyle = `rgba(255, 40, 30, ${Math.min(0.35, game.alarmFlash * 0.3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPOTTED!', VIEW_W / 2, 120);
    ctx.textAlign = 'left';
  }

  if (game.state === 'title') drawTitle(ctx, game);
  else if (game.state === 'won') {
    drawBanner(ctx, 'VAULT CRACKED', `All 3 shards stolen in ${game.winTime} — the night is yours.`, '#7dffb0');
  } else if (game.state === 'lost') {
    drawBanner(ctx, 'CAUGHT!', 'A guard laid hands on you under the lanterns.', '#ff5040');
  }
}
