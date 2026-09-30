const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../js/arcade.js"), "utf8");

function harness(level, { width = 360, height = 600 } = {}) {
  let state;
  let nextFrame;
  let now = 0;
  let wins = 0;
  let losses = 0;
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => gradient;
      return () => {};
    }
  });
  const canvas = {
    style: {},
    parentElement: { getBoundingClientRect: () => ({ width, height }) },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: parseFloat(canvas.style.width), height: parseFloat(canvas.style.height) })
  };
  const window = {
    devicePixelRatio: 1,
    performance: { now: () => now },
    addEventListener() {},
    requestAnimationFrame(callback) { nextFrame = callback; return 1; },
    cancelAnimationFrame() { nextFrame = undefined; }
  };
  const math = Object.create(Math);
  math.random = () => 0.5;
  vm.runInNewContext(source, { window, Math: math });
  const game = window.SavageArcade.createGame({
    canvas,
    onHud(value) { state = value; },
    onWin() { wins++; },
    onLose() { losses++; }
  });
  game.start(level);
  game.resize();
  function advance(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 10) {
      assert(nextFrame, "The game should keep drawing during victory");
      now += 10;
      const frame = nextFrame;
      nextFrame = undefined;
      frame(now);
    }
  }
  function finalHit() {
    state.invaders.forEach(inv => { inv.alive = false; });
    const inv = state.invaders[0];
    Object.assign(inv, { alive: true, hp: 1, x: 100, y: 100 });
    state.player.cooldown = 10000;
    state.shots = [{ x: inv.x + 10, y: inv.y + 5, w: 3, h: 10, vy: 0 }];
    // A projectile already touching the craft must not undo the final hit.
    state.enemyShots = [{ x: state.player.x, y: state.player.y, w: 3, h: 8, vy: 0 }];
    advance(10);
  }
  return { game, advance, finalHit, setRandom(value) { math.random = () => value; }, get state() { return state; }, get wins() { return wins; }, get losses() { return losses; } };
}

for (const level of [1, 2, 3]) {
  const test = harness(level);
  test.advance(10);
  assert.equal(test.state.status, "playing", "A live wave must not show victory");
  test.finalHit();
  assert.equal(test.state.status, "celebrating");
  assert.equal(test.state.invaders.filter(inv => inv.alive).length, 0);
  assert.equal(test.wins, 0, "Continue prompt must wait for the final explosion");
  assert.equal(test.losses, 0);
  assert.equal(test.state.lives, 3);
  assert.equal(test.state.enemyShots.length, 0);
  assert(test.state.booms.length > 0, "The final hit must produce an explosion");
  const particle = test.state.booms[0];
  const start = { x: particle.x, y: particle.y, t: particle.t };
  test.advance(200);
  assert(particle.t < start.t && (particle.x !== start.x || particle.y !== start.y), "Victory particles must animate");
  test.advance(1100);
  assert.equal(test.wins, 0, "Keep the stage visible for the full victory pause");
  assert.equal(test.state.booms.length, 0, "Explosion must finish before the prompt");
  test.advance(100);
  assert.equal(test.state.status, "won");
  assert.equal(test.wins, 1);
  test.advance(500);
  assert.equal(test.wins, 1, "Only one completion event per wave");
  console.log(`PASS level ${level}: final hit, animated pause, and one completion event`);
}

const paused = harness(3);
paused.finalHit();
paused.game.pause();
paused.advance(2000);
assert.equal(paused.wins, 0, "Pausing must also pause the victory countdown");
paused.game.resume();
paused.advance(1400);
assert.equal(paused.wins, 1);

const restarted = harness(3);
restarted.finalHit();
restarted.advance(300);
restarted.game.start(1);
restarted.game.resize();
restarted.advance(1600);
assert.equal(restarted.state.level.id, 1);
assert.equal(restarted.state.status, "playing");
assert.equal(restarted.wins, 0, "A previous wave must not finish over a new game");
restarted.game.stop();
assert.equal(restarted.wins, 0);
console.log("PASS pause, restart, and stop during victory");

for (const level of [1, 2, 3]) {
  for (const shape of [{ width: 1440, height: 844 }, { width: 844, height: 260 }, { width: 320, height: 390 }]) {
    const test = harness(level, shape);
    const bottom = Math.max(...test.state.invaders.map(inv => inv.y + inv.h));
    assert(test.state.player.y - bottom >= 240, "Every level needs reaction room on every screen");
  }
  const drops = harness(level);
  drops.setRandom(0);
  drops.state.player.cooldown = 10000;
  drops.state.player.iframe = 10000;
  for (let kill = 0; kill < 8; kill++) {
    const inv = drops.state.invaders[0];
    Object.assign(inv, { alive: true, hp: 1, x: 100, y: 100 });
    drops.state.shots = [{ x: 110, y: 105, w: 3, h: 10, vy: 0 }];
    drops.advance(10);
    if (kill === 0) assert.equal(drops.state.pickups[0].kind, "bomb", "The first kill must drop a bomb");
  }
  assert.equal(drops.state.bombDrops, 2);
  assert.equal(drops.state.rapidDrops, 1, "Never send a second rapid pickup in a wave");

  const rapid = harness(level);
  rapid.state.player.cooldown = 10000;
  rapid.state.pickups.push({ kind: "rapid", x: 100, y: 100, w: 27, h: 27, vy: 52, t: 0 });
  assert.equal(rapid.game.tap(110, 110), true);
  assert.equal(rapid.state.player.rapid, 2000);
  rapid.advance(1990);
  assert.equal(rapid.state.player.rapid, 10);
  rapid.advance(10);
  assert.equal(rapid.state.player.rapid, 0);

  const target = harness(level);
  target.state.player.cooldown = 20000;
  target.advance(6100);
  assert.equal(target.state.saucer.hp, 10);
  target.state.saucer.vx = 0;
  for (let hit = 1; hit <= 10; hit++) {
    const s = target.state.saucer;
    target.state.shots = [{ kind: "shot", x: s.x + 5, y: s.y + 5, w: 3, h: 1, vy: 0 }];
    target.advance(10);
    if (hit < 10) {
      assert.equal(target.state.saucer.hp, 10 - hit);
      assert(target.state.saucer.hitFlash > 0);
    } else assert.equal(target.state.saucer, null, "Exactly ten ordinary shots destroy the target");
  }
  assert.equal(target.state.score, 150);
  target.advance(16000);
  assert.equal(target.state.saucer, null, "Only one top bonus target per wave");
  console.log(`PASS level ${level}: safe starting layout, earlier bombs, one two-second rapid drop, and ten-hit target`);
}

const column = harness(3);
column.state.level = { ...column.state.level, stepMs: 100000, minStepMs: 100000 };
column.state.player.cooldown = 20000;
column.state.invaders.forEach(inv => { inv.alive = false; });
const [lower, upper, outside] = column.state.invaders;
Object.assign(lower, { alive: true, hp: 3, x: 170, y: 200 });
Object.assign(upper, { alive: true, hp: 3, x: 170, y: 110 });
Object.assign(outside, { alive: true, hp: 3, x: 300, y: 110 });
column.state.saucer = { x: 156, y: 2, w: 48, h: 21, vx: 0, hp: 10, maxHp: 10, hitFlash: 0 };
column.state.saucerIn = Infinity;
column.state.enemyShots = [{ x: 180, y: 150, w: 3, h: 8, vy: 0 }];
column.state.heldBombs = 1;
column.game.bomb();
column.advance(4100);
assert.equal(lower.alive, false);
assert.equal(upper.alive, false);
assert.equal(outside.alive, true, "Bombs should clear their column, not the whole screen");
assert.equal(column.state.saucer, null, "One bomb destroys the armored top target");
assert.equal(column.state.enemyShots.length, 0);
assert.equal(column.state.status, "playing");
console.log("PASS bomb pierces armored enemies and top target, clears projectiles, and preserves adjacent columns");
