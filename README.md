# Emberwick Vault — a lantern-thief stealth game

**make.fun entry for [best-stealth-game-20261121-1759](https://make.fun/bounty/best-stealth-game-20261121-1759) — "Make the best stealth game".**

Slip into the vault after dark. Pocket all 3 Ember Shards, then reach the
green EXIT unseen. Four guards patrol with lanterns and visible vision
cones — cross a cone and their suspicion fills; break line of sight and it
drains again, so a near miss still gives you a chance to recover. Hide in
the hedges, sneak with Shift, and throw pebbles with a click to lure a
guard away from your route. If a guard catches you while the alarm is up,
the night is over.

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

WASD / arrows — move · Shift — sneak · Click — throw a pebble · M — mute.
Fully offline: no network requests, all art drawn on canvas, all sounds
synthesised with WebAudio.

## Files

- `main.ts` — the hand-in program (Node 22): copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`.
- `game/index.html` — the page; `game/main.js` — state, loop and rules.
- `game/level.js` — the vault floor plan, sight lines and collision.
- `game/guard.js` — patrols, vision cones, suspicion, chase and recovery.
- `game/player.js` — the thief: movement, sneaking, pebbles, shards.
- `game/audio.js` — footsteps, alarm, chimes, all synthesised.
- `game/render.js` — the hall, the cones, the lighting, the HUD.
- `game/input.js` — keyboard and mouse.
- `screenshots/` — 4 real renders of the game's own code (cover first).

Original work: its own idea, art, sounds and names — not a copy of any
commercial game. MIT licensed.
