const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../js/arcade.js"), "utf8");

function harness(level) {
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
    parentElement: { getBoundingClientRect: () => ({ width: 360, height: 600 }) },
    getContext: () => ctx
  };
  const window = {
    devicePixelRatio: 1,
    performance: { now: () => now },
    addEventListener() {},
    requestAnimationFrame(callback) { nextFrame = callback; return 1; },
    cancelAnimationFrame() { nextFrame = undefined; }
  };
  vm.runInNewContext(source, { window });
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
  return { game, advance, finalHit, get state() { return state; }, get wins() { return wins; }, get losses() { return losses; } };
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
