(function (global) {
  const BODY = {
    bug: { cols: 11, rows: 8, color: "#ff3d7f", accent: "#ffd0e6", glow: "rgba(255,61,127,0.45)" },
    ticket: { cols: 11, rows: 8, color: "#3fe0ff", accent: "#d7fbff", glow: "rgba(63,224,255,0.4)" },
    scope: { cols: 11, rows: 8, color: "#b56bff", accent: "#f0dcff", glow: "rgba(181,107,255,0.42)" },
    form: { cols: 11, rows: 8, color: "#5dffc3", accent: "#dcfff4", glow: "rgba(93,255,195,0.4)" },
    mail: { cols: 11, rows: 8, color: "#ffd56a", accent: "#fff4c8", glow: "rgba(255,213,106,0.42)" },
    meeting: { cols: 11, rows: 8, color: "#ff9a3d", accent: "#ffe0c2", glow: "rgba(255,154,61,0.4)" },
    player: { cols: 13, rows: 9, color: "#e8f6ff", accent: "#7cf0ff", glow: "rgba(124,240,255,0.5)" },
    saucer: { cols: 16, rows: 7, color: "#ffe07a", accent: "#fff6c8", glow: "rgba(255,224,122,0.5)" },
    bomb: { cols: 9, rows: 9, color: "#ff8a3d", accent: "#ffd0a8", glow: "rgba(255,138,61,0.55)" },
    rapid: { cols: 9, rows: 9, color: "#5ce1ff", accent: "#e7fbff", glow: "rgba(92,225,255,0.55)" }
  };

  const LEVELS = {
    1: {
      id: 1,
      name: "Clear the Bugs",
      reward: "about",
      rewardLabel: "About Dan",
      rows: [
        { type: "bug", count: 7 },
        { type: "bug", count: 7 },
        { type: "bug", count: 7 }
      ],
      stepMs: 300,
      minStepMs: 140,
      stepPx: 9,
      drop: 10,
      fireChance: 0.009,
      maxPlayerShots: 10,
      cooldown: 300,
      shotSpeed: 100,
      pickupChance: 0.09,
      maxBombDrops: 2,
      maxRapidDrops: 2
    },
    2: {
      id: 2,
      name: "Ship the Work",
      reward: "projects",
      rewardLabel: "Projects",
      rows: [
        { type: "ticket", count: 8 },
        { type: "scope", count: 8 },
        { type: "form", count: 8 },
        { type: "bug", count: 8 }
      ],
      stepMs: 220,
      minStepMs: 95,
      stepPx: 10,
      drop: 12,
      fireChance: 0.018,
      maxPlayerShots: 10,
      cooldown: 300,
      shotSpeed: 108,
      pickupChance: 0.07,
      maxBombDrops: 2,
      maxRapidDrops: 2
    },
    3: {
      id: 3,
      name: "Open the Channel",
      reward: "contact",
      rewardLabel: "Contact",
      rows: [
        { type: "bug", count: 5, hp: 4, unit: 5 },
        { type: "mail", count: 8 },
        { type: "meeting", count: 8 },
        { type: "ticket", count: 8 },
        { type: "bug", count: 8 }
      ],
      stepMs: 250,
      minStepMs: 120,
      stepPx: 8,
      drop: 10,
      fireChance: 0.018,
      maxPlayerShots: 10,
      cooldown: 300,
      shotSpeed: 112,
      pickupChance: 0.06,
      maxBombDrops: 2,
      maxRapidDrops: 2
    }
  };

  const UNIT = 3;
  const MAX_BOMBS = 3;
  const RAPID_MULT = 10;
  const RAPID_MS = 3000;

  function spriteDim(type, unit) {
    const body = BODY[type] || BODY.bug;
    const u = unit || UNIT;
    return { w: body.cols * u, h: body.rows * u };
  }

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function shade(hex, amt) {
    const c = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const r = Math.round((t - c.r) * p) + c.r;
    const g = Math.round((t - c.g) * p) + c.g;
    const b = Math.round((t - c.b) * p) + c.b;
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function createGame(options) {
    const canvas = options.canvas;
    const ctx = canvas.getContext("2d");
    const input = { left: false, right: false, fire: false, bomb: false };

    let running = false;
    let paused = false;
    let muted = false;
    let raf = 0;
    let last = 0;
    let audio;
    let state = null;
    let worldW = 360;
    let worldH = 480;
    let scale = 1;

    function tone(freq, dur, type, vol) {
      if (muted) return;
      try {
        audio = audio || new (global.AudioContext || global.webkitAudioContext)();
        if (audio.state === "suspended") audio.resume();
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = type || "square";
        osc.frequency.value = freq;
        gain.gain.value = vol || 0.04;
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
        osc.stop(audio.currentTime + dur);
      } catch (err) {}
    }

    function resize() {
      const parent = canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : { width: 0, height: 0 };
      let w = Math.round(rect.width || (parent && parent.clientWidth) || 0);
      let h = Math.round(rect.height || (parent && parent.clientHeight) || 0);
      if (w < 32) w = global.innerWidth || 360;
      if (h < 32) h = Math.max(160, (global.innerHeight || 640) - 180);
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      worldW = 360;
      scale = canvas.width / worldW;
      worldH = canvas.height / scale;
      if (state && state.player) state.player.y = worldH - state.player.h - 16;
    }

    function spawnLevel(id) {
      const level = LEVELS[id] || LEVELS[1];
      const invaders = [];
      let y = 36;
      level.rows.forEach(function (row) {
        const unit = row.unit || UNIT;
        const dim = spriteDim(row.type, unit);
        const cell = Math.max(dim.w + 8, 36);
        const totalW = row.count * cell;
        const startX = Math.max(6, (worldW - totalW) / 2);
        for (let i = 0; i < row.count; i++) {
          const hp = row.hp || 1;
          invaders.push({
            type: row.type,
            x: startX + i * cell,
            y: y,
            w: dim.w,
            h: dim.h,
            unit: unit,
            hp: hp,
            maxHp: hp,
            hitFlash: 0,
            phase: Math.random() * Math.PI * 2,
            alive: true
          });
        }
        y += dim.h + 10;
      });
      const ship = spriteDim("player");
      state = {
        level: level,
        score: 0,
        lives: 3,
        heldBombs: 0,
        bombDrops: 0,
        rapidDrops: 0,
        kills: 0,
        combo: 0,
        lastKillT: -9999,
        callouts: {},
        invaders: invaders,
        dir: 1,
        stepMs: level.stepMs,
        stepAcc: 0,
        t: 0,
        player: { x: worldW / 2 - ship.w / 2, y: 0, w: ship.w, h: ship.h, cooldown: 0, iframe: 0, rapid: 0 },
        shots: [],
        enemyShots: [],
        pickups: [],
        booms: [],
        waves: [],
        floaters: [],
        saucer: null,
        saucerIn: 7000 + Math.random() * 4000,
        stars: Array.from({ length: 70 }, function () {
          return {
            x: Math.random() * worldW,
            y: Math.random() * 700,
            s: Math.random() * 1.6 + 0.3,
            v: Math.random() * 18 + 8,
            a: Math.random() * 0.7 + 0.25
          };
        }),
        status: "playing",
        flash: 0,
        shake: 0
      };
    }

    function living() {
      return state.invaders.filter(function (inv) { return inv.alive; });
    }

    function hit(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function explode(x, y, color, n) {
      const count = n || 14;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const spd = 30 + Math.random() * 110;
        state.booms.push({
          x: x, y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          t: 420 + Math.random() * 180,
          r: 1.2 + Math.random() * 2.4,
          color: color
        });
      }
    }

    function floater(x, y, text) {
      state.floaters.push({ x: x, y: y, text: text, t: 800 });
    }

    function wave(x, y, maxR, color) {
      state.waves.push({ x: x, y: y, r: 4, max: maxR, color: color || "#7cf0ff" });
    }

    function tryDrop(inv) {
      const level = state.level;
      const canBomb = state.bombDrops < (level.maxBombDrops || 2);
      const canRapid = state.rapidDrops < (level.maxRapidDrops || 2);
      if (!canBomb && !canRapid) return;
      const forceRapid = canRapid && state.rapidDrops === 0 && state.kills <= 2;
      if (!forceRapid && Math.random() > (level.pickupChance || 0.08)) return;
      let kind = "bomb";
      if (forceRapid) kind = "rapid";
      else if (canBomb && canRapid) kind = Math.random() < 0.4 ? "bomb" : "rapid";
      else if (canRapid) kind = "rapid";
      const dim = spriteDim(kind);
      state.pickups.push({
        kind: kind,
        x: inv.x + inv.w / 2 - dim.w / 2,
        y: inv.y,
        w: dim.w,
        h: dim.h,
        vy: kind === "rapid" ? 52 : 36,
        t: 0
      });
      if (kind === "bomb") {
        state.bombDrops += 1;
        callout("Pick up the bomb", "bomb");
      } else {
        state.rapidDrops += 1;
        callout("Pick up the rapid fire", "rapid");
      }

    function finishKill(inv, points) {
      inv.alive = false;
      inv.hp = 0;
      const pts = points || (10 * state.level.id * (inv.maxHp > 1 ? 3 : 1));
      state.score += pts;
      state.kills += 1;
      if (state.t - state.lastKillT < 1000) state.combo += 1;
      else state.combo = 1;
      state.lastKillT = state.t;
      if (state.combo === 5) callout("5 streak", "streak");
      if (state.combo === 10) callout("10 streak", "streak");
      if (state.combo >= 3) state.score += state.combo;
      const skin = BODY[inv.type] || BODY.bug;
      explode(inv.x + inv.w / 2, inv.y + inv.h / 2, skin.color, inv.maxHp > 1 ? 22 : 14);
      floater(inv.x, inv.y, "+" + pts);
      tone(300, 0.08);
      tryDrop(inv);
    }

    function damageInvader(inv, opts) {
      if (!inv.alive) return;
      opts = opts || {};
      if (opts.pierce || inv.maxHp <= 1) {
        finishKill(inv, opts.points);
        return;
      }
      inv.hp -= opts.dmg || 1;
      inv.hitFlash = 90;
      if (inv.hp <= 0) {
        finishKill(inv, opts.points);
        return;
      }
      explode(inv.x + inv.w / 2, inv.y + inv.h / 2, BODY[inv.type].color, 5);
      tone(210, 0.05, "square", 0.03);
    }

    function firePlayer() {
      if (!state || state.status !== "playing") return;
      if (state.player.cooldown > 0) return;
      const rapid = state.player.rapid > 0;
      const muzzleY = state.player.y - 40;
      const nearby = state.shots.filter(function (s) {
        return s.kind === "shot" && s.y > muzzleY;
      }).length;
      const maxNear = rapid ? 6 : 1;
      if (nearby >= maxNear) return;
      const speed = (state.level.shotSpeed || 140) * (rapid ? 1.15 : 1);
      state.shots.push({
        x: state.player.x + state.player.w / 2 - 1.2,
        y: state.player.y - 6,
        vy: -speed,
        w: 2.4,
        h: rapid ? 11 : 10,
        kind: "shot",
        rapid: rapid,
        struck: []
      });
      state.player.cooldown = rapid ? state.level.cooldown / RAPID_MULT : state.level.cooldown;
      if (!rapid || nearby % 4 === 0) tone(rapid ? 820 : 520, 0.03, "sine", rapid ? 0.014 : 0.02);
    }

    function callout(text, kind) {
      if (!options.onCallout) return;
      options.onCallout(text, kind || "");
    }

    function collectPickup(item, labelX, labelY) {
      item.y = worldH + 40;
      if (item.kind === "rapid") {
        state.player.rapid = RAPID_MS;
        floater(labelX, labelY, "RAPID x10");
        tone(880, 0.12, "triangle");
        tone(1240, 0.1, "sine", 0.03);
        return;
      }
      if (state.heldBombs < MAX_BOMBS) {
        state.heldBombs += 1;
        floater(labelX, labelY, "BOMB");
        tone(740, 0.1, "triangle");
      } else {
        state.score += 50;
        floater(labelX, labelY, "+50");
      }
    }

    function launchRocket(x, y) {
      const dim = spriteDim("bomb");
      state.shots.push({
        x: x - dim.w / 2,
        y: y - dim.h,
        w: dim.w,
        h: dim.h,
        vy: -130,
        kind: "rocket",
        struck: [],
        trail: 0
      });
      state.shake = 90;
      wave(x, y, 34, "#ff9a3d");
      tone(180, 0.12, "sawtooth", 0.05);
      tone(420, 0.16, "sine", 0.04);
    }

    function useBomb() {
      if (!state || state.status !== "playing" || paused) return;
      if (state.heldBombs <= 0) {
        tone(110, 0.08, "sawtooth", 0.03);
        return;
      }
      state.heldBombs -= 1;
      const p = state.player;
      launchRocket(p.x + p.w / 2, p.y);
      if (options.onHud) options.onHud(state);
    }

    function tapWorld(x, y) {
      if (!state || state.status !== "playing" || paused) return false;
      const pad = 16;
      for (let i = state.pickups.length - 1; i >= 0; i--) {
        const item = state.pickups[i];
        if (x >= item.x - pad && x <= item.x + item.w + pad && y >= item.y - pad && y <= item.y + item.h + pad) {
          collectPickup(item, item.x, item.y);
          if (options.onHud) options.onHud(state);
          return true;
        }
      }
      return false;
    }

    function loseLife() {
      if (state.player.iframe > 0) return;
      state.lives -= 1;
      state.flash = 180;
      state.shake = 160;
      state.player.iframe = 1100;
      tone(90, 0.2, "sawtooth");
      state.enemyShots = [];
      state.shots = [];
      if (state.lives === 1) callout("Last life", "warn");
      if (state.lives <= 0) {
        state.status = "lost";
        if (options.onLose) options.onLose(state);
      }
    }

    function bottomShooters(alive) {
      const cols = {};
      alive.forEach(function (inv) {
        const key = Math.round(inv.x / 8);
        if (!cols[key] || inv.y > cols[key].y) cols[key] = inv;
      });
      return Object.keys(cols).map(function (k) { return cols[k]; });
    }

    function update(dt) {
      if (!state || state.status !== "playing" || paused) return;
      const p = state.player;
      state.t += dt * 1000;
      p.y = worldH - p.h - 16;
      const speed = 175;
      if (input.left) p.x -= speed * dt;
      if (input.right) p.x += speed * dt;
      p.x = Math.max(4, Math.min(worldW - p.w - 4, p.x));
      if (Math.random() < (p.rapid > 0 ? 0.7 : 0.35)) {
        state.booms.push({
          x: p.x + p.w / 2 + (Math.random() - 0.5) * 8,
          y: p.y + p.h,
          vx: (Math.random() - 0.5) * 16,
          vy: 50 + Math.random() * 20,
          t: 160,
          r: 1.1 + Math.random(),
          color: p.rapid > 0 ? "#7cf0ff" : "#ffb347"
        });
      }
      firePlayer();
      if (input.bomb) {
        useBomb();
        input.bomb = false;
      }
      const wasRapid = p.rapid > 0;
      p.cooldown = Math.max(0, p.cooldown - dt * 1000);
      p.iframe = Math.max(0, p.iframe - dt * 1000);
      p.rapid = Math.max(0, p.rapid - dt * 1000);
      if (wasRapid && p.rapid <= 0) p.cooldown = 0;
      state.shake = Math.max(0, state.shake - dt * 1000);
      living().forEach(function (inv) {
        inv.hitFlash = Math.max(0, (inv.hitFlash || 0) - dt * 1000);
      });

      state.stars.forEach(function (star) {
        star.y += star.v * dt;
        if (star.y > worldH) {
          star.y = 0;
          star.x = Math.random() * worldW;
        }
      });

      state.saucerIn -= dt * 1000;
      if (!state.saucer && state.saucerIn <= 0) {
        const dim = spriteDim("saucer");
        const left = Math.random() < 0.5;
        state.saucer = {
          x: left ? -dim.w : worldW + 2,
          y: 14,
          w: dim.w,
          h: dim.h,
          vx: left ? 90 : -90
        };
        state.saucerIn = 11000 + Math.random() * 6000;
        tone(760, 0.12, "sine", 0.03);
        callout("Destroy that to activate a bomb", "saucer");
      }
      if (state.saucer) {
        state.saucer.x += state.saucer.vx * dt;
        if (state.saucer.x < -50 || state.saucer.x > worldW + 50) state.saucer = null;
      }

      state.shots.forEach(function (shot) { shot.y += shot.vy * dt; });
      state.shots = state.shots.filter(function (shot) { return shot.y > -20 && shot.y < worldH + 12; });

      const alive = living();
      const remainRatio = alive.length / Math.max(1, state.invaders.length);
      const stepTarget = state.level.minStepMs + (state.level.stepMs - state.level.minStepMs) * remainRatio;
      state.stepAcc += dt * 1000;
      if (alive.length && state.stepAcc >= stepTarget) {
        state.stepAcc = 0;
        let hitEdge = false;
        const step = state.level.stepPx || 10;
        alive.forEach(function (inv) {
          inv.x += state.dir * step;
          if (inv.x < 4 || inv.x + inv.w > worldW - 4) hitEdge = true;
        });
        if (hitEdge) {
          state.dir *= -1;
          alive.forEach(function (inv) {
            inv.x += state.dir * step;
            inv.y += state.level.drop;
          });
        }
        tone(120 + alive.length * 2, 0.03, "sine", 0.018);
      }

      const shooters = bottomShooters(alive);
      if (shooters.length && Math.random() < state.level.fireChance) {
        const shooter = shooters[Math.floor(Math.random() * shooters.length)];
        state.enemyShots.push({
          x: shooter.x + shooter.w / 2 - 1.4,
          y: shooter.y + shooter.h,
          vy: 120 + state.level.id * 28,
          w: 2.8,
          h: 8
        });
      }

      state.enemyShots.forEach(function (bomb) { bomb.y += bomb.vy * dt; });
      state.enemyShots = state.enemyShots.filter(function (bomb) { return bomb.y < worldH + 10; });

      state.pickups.forEach(function (item) {
        item.y += item.vy * dt;
        item.t += dt * 1000;
        const dx = (p.x + p.w / 2) - (item.x + item.w / 2);
        const dy = p.y - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 96 && dist > 1) {
          item.x += (dx / dist) * 90 * dt;
          item.y += (dy / dist) * 90 * dt;
        }
      });
      state.pickups = state.pickups.filter(function (item) { return item.y < worldH + 16; });

      state.shots.forEach(function (shot) {
        if (shot.kind === "rocket") {
          shot.trail = (shot.trail || 0) + 1;
          if (shot.trail % 2 === 0) {
            state.booms.push({
              x: shot.x + shot.w / 2 + (Math.random() - 0.5) * 4,
              y: shot.y + shot.h,
              vx: (Math.random() - 0.5) * 18,
              vy: 36,
              t: 200,
              r: 1.6,
              color: "#ff9a3d"
            });
          }
        }
        alive.forEach(function (inv) {
          if (!inv.alive) return;
          if (!hit(shot, inv)) return;
          if (shot.kind === "rocket") {
            if (shot.struck.indexOf(inv) !== -1) return;
            shot.struck.push(inv);
            damageInvader(inv, { pierce: true, points: 20 * state.level.id });
            state.shake = Math.max(state.shake, 70);
          } else {
            shot.y = -99;
            damageInvader(inv);
          }
        });
        if (shot.kind === "rocket") {
          state.enemyShots = state.enemyShots.filter(function (bomb) { return !hit(shot, bomb); });
        }
        if (state.saucer && hit(shot, state.saucer)) {
          if (shot.kind !== "rocket") shot.y = -99;
          explode(state.saucer.x + state.saucer.w / 2, state.saucer.y + 4, "#ffe07a", 16);
          state.score += 150;
          floater(state.saucer.x, state.saucer.y, "+150");
          tone(980, 0.14, "sine");
          if (state.heldBombs < MAX_BOMBS && state.bombDrops < (state.level.maxBombDrops || 2)) {
            state.heldBombs += 1;
            state.bombDrops += 1;
            floater(state.saucer.x, state.saucer.y + 12, "BOMB");
          }
          state.saucer = null;
        }
      });

      const playerBox = { x: p.x, y: p.y, w: p.w, h: p.h };
      state.pickups.forEach(function (item) {
        if (hit(item, playerBox)) collectPickup(item, p.x, p.y - 12);
      });

      if (p.iframe <= 0) {
        state.enemyShots.forEach(function (bomb) {
          if (hit(bomb, playerBox)) {
            bomb.y = worldH + 40;
            explode(p.x + p.w / 2, p.y, "#7cf0ff", 10);
            loseLife();
          }
        });
      }

      alive.forEach(function (inv) {
        if (inv.y + inv.h >= p.y) {
          state.lives = 0;
          state.status = "lost";
          if (options.onLose) options.onLose(state);
        }
      });

      state.booms.forEach(function (b) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.t -= dt * 1000;
      });
      state.booms = state.booms.filter(function (b) { return b.t > 0; });
      state.waves.forEach(function (w) { w.r += 240 * dt; });
      state.waves = state.waves.filter(function (w) { return w.r < w.max; });
      state.floaters.forEach(function (f) {
        f.y -= 28 * dt;
        f.t -= dt * 1000;
      });
      state.floaters = state.floaters.filter(function (f) { return f.t > 0; });
      state.flash = Math.max(0, state.flash - dt * 1000);

      if (!living().length && state.status === "playing") {
        state.status = "won";
        tone(520, 0.12, "sine");
        tone(740, 0.18, "sine");
        if (options.onWin) options.onWin(state);
      }

      if (options.onHud) options.onHud(state);
    }

    function roundRect(x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function drawBackdrop() {
      const sky = ctx.createLinearGradient(0, 0, 0, worldH);
      sky.addColorStop(0, "#050018");
      sky.addColorStop(0.38, "#0b1233");
      sky.addColorStop(0.72, "#14102c");
      sky.addColorStop(1, "#1b0c22");
      ctx.fillStyle = sky;
      ctx.fillRect(-6, -6, worldW + 12, worldH + 12);

      ctx.globalAlpha = 0.35;
      const nebA = ctx.createRadialGradient(worldW * 0.2, worldH * 0.18, 8, worldW * 0.2, worldH * 0.18, 140);
      nebA.addColorStop(0, "rgba(90, 40, 180, 0.7)");
      nebA.addColorStop(1, "rgba(90, 40, 180, 0)");
      ctx.fillStyle = nebA;
      ctx.fillRect(0, 0, worldW, worldH);
      const nebB = ctx.createRadialGradient(worldW * 0.82, worldH * 0.28, 8, worldW * 0.82, worldH * 0.28, 160);
      nebB.addColorStop(0, "rgba(20, 160, 220, 0.45)");
      nebB.addColorStop(1, "rgba(20, 160, 220, 0)");
      ctx.fillStyle = nebB;
      ctx.fillRect(0, 0, worldW, worldH);
      ctx.globalAlpha = 1;

      state.stars.forEach(function (star) {
        ctx.globalAlpha = star.a;
        ctx.fillStyle = star.s > 1.2 ? "#c8f4ff" : "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      const horizon = worldH * 0.42;
      const vanishX = worldW / 2;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const y = horizon + Math.pow(t, 1.65) * (worldH - horizon);
        ctx.strokeStyle = "rgba(90, 230, 255," + (0.04 + t * 0.12) + ")";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(worldW, y);
        ctx.stroke();
      }
      for (let i = -14; i <= 14; i++) {
        ctx.strokeStyle = "rgba(90, 230, 255, 0.08)";
        ctx.beginPath();
        ctx.moveTo(vanishX + i * 10, horizon);
        ctx.lineTo(vanishX + i * 86, worldH + 8);
        ctx.stroke();
      }
    }

    function drawDrone(inv) {
      const skin = BODY[inv.type] || BODY.bug;
      const bob = Math.sin((state.t / 260) + inv.phase) * 2.2;
      const x = inv.x;
      const y = inv.y + bob;
      const w = inv.w;
      const h = inv.h;
      const cx = x + w / 2;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(cx, y + h + 4, w * 0.38, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.shadowColor = inv.hitFlash > 0 ? "#ffffff" : skin.glow;
      ctx.shadowBlur = inv.maxHp > 1 ? 16 : 10;
      const body = ctx.createLinearGradient(x, y, x + w, y + h);
      const top = inv.hitFlash > 0 ? "#ffffff" : shade(skin.color, 0.35);
      const mid = inv.hitFlash > 0 ? skin.accent : (inv.hp < inv.maxHp ? shade(skin.color, -0.12) : skin.color);
      const bot = shade(skin.color, -0.45);
      body.addColorStop(0, top);
      body.addColorStop(0.45, mid);
      body.addColorStop(1, bot);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, y + h * 0.42);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, y + h * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.moveTo(cx, y + 2);
      ctx.lineTo(x + w * 0.72, y + h * 0.38);
      ctx.lineTo(cx, y + h * 0.34);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = skin.accent;
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.46, Math.max(2.2, w * 0.09), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#081018";
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.46, Math.max(1, w * 0.04), 0, Math.PI * 2);
      ctx.fill();

      if (inv.maxHp > 1) {
        const ratio = Math.max(0, inv.hp / inv.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        roundRect(x + 4, y - 6, w - 8, 3, 1.5);
        ctx.fill();
        ctx.fillStyle = ratio > 0.5 ? "#5dffc3" : "#ff5d7a";
        roundRect(x + 4, y - 6, (w - 8) * ratio, 3, 1.5);
        ctx.fill();
      }
    }

    function drawSaucer(s) {
      const x = s.x;
      const y = s.y + Math.sin(state.t / 180) * 1.5;
      const w = s.w;
      const h = s.h;
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.save();
      ctx.shadowColor = "rgba(255,224,122,0.65)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "rgba(255,224,122,0.18)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, w * 0.52, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      const rim = ctx.createLinearGradient(x, y, x + w, y + h);
      rim.addColorStop(0, "#fff6c8");
      rim.addColorStop(0.5, "#e6b84a");
      rim.addColorStop(1, "#8a5a12");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.48, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9ef6ff";
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, w * 0.18, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawPickup(item) {
      const skin = BODY[item.kind] || BODY.bomb;
      const spin = item.t / 180;
      const cx = item.x + item.w / 2;
      const cy = item.y + item.h / 2 + Math.sin(item.t / 140) * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(spin) * 0.4);
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur = 12;
      const g = ctx.createRadialGradient(0, -2, 1, 0, 0, item.w * 0.55);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, skin.accent);
      g.addColorStop(1, skin.color);
      ctx.fillStyle = g;
      if (item.kind === "rapid") {
        ctx.beginPath();
        ctx.moveTo(0, -item.h * 0.48);
        ctx.lineTo(item.w * 0.28, 0);
        ctx.lineTo(0, item.h * 0.48);
        ctx.lineTo(-item.w * 0.28, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, item.w * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, item.w * 0.42, item.h * 0.16, 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFighter(p) {
      const rapid = p.rapid > 0;
      const x = p.x;
      const y = p.y;
      const w = p.w;
      const h = p.h;
      const cx = x + w / 2;
      if (p.iframe > 0 && Math.floor(p.iframe / 80) % 2 === 1) return;

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(cx, y + h + 5, w * 0.34, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();

      const flame = 7 + Math.sin(state.t / 50) * 3;
      const fg = ctx.createLinearGradient(cx, y + h, cx, y + h + flame);
      fg.addColorStop(0, rapid ? "#b8ffff" : "#ffe7a8");
      fg.addColorStop(1, rapid ? "rgba(80,220,255,0)" : "rgba(255,120,40,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(cx - 5, y + h - 1);
      ctx.lineTo(cx, y + h + flame);
      ctx.lineTo(cx + 5, y + h - 1);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.shadowColor = rapid ? "rgba(92,225,255,0.8)" : "rgba(214,179,106,0.45)";
      ctx.shadowBlur = rapid ? 16 : 8;
      ctx.fillStyle = shade("#7a8ca8", -0.2);
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.72);
      ctx.lineTo(cx - 6, y + h * 0.4);
      ctx.lineTo(cx + 6, y + h * 0.4);
      ctx.lineTo(x + w, y + h * 0.72);
      ctx.closePath();
      ctx.fill();

      const hull = ctx.createLinearGradient(x, y, x + w, y + h);
      hull.addColorStop(0, rapid ? "#e7ffff" : "#f4fbff");
      hull.addColorStop(0.45, rapid ? "#7cf0ff" : "#c5d4e6");
      hull.addColorStop(1, "#3b4b63");
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w * 0.78, y + h * 0.62);
      ctx.lineTo(cx, y + h * 0.86);
      ctx.lineTo(x + w * 0.22, y + h * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = rapid ? "#9af7ff" : "#7cf0ff";
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.42, 4.2, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(8,16,32,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.42, 2.1, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw() {
      if (!state) return;
      const ox = state.shake ? (Math.random() - 0.5) * 2.4 : 0;
      const oy = state.shake ? (Math.random() - 0.5) * 2.4 : 0;
      ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
      ctx.imageSmoothingEnabled = true;
      drawBackdrop();

      living().forEach(drawDrone);
      if (state.saucer) drawSaucer(state.saucer);
      state.pickups.forEach(drawPickup);

      state.shots.forEach(function (shot) {
        if (shot.kind === "rocket") {
          drawPickup({ kind: "bomb", x: shot.x, y: shot.y, w: shot.w, h: shot.h, t: state.t });
          const flame = ctx.createLinearGradient(shot.x, shot.y + shot.h, shot.x, shot.y + shot.h + 10);
          flame.addColorStop(0, "#ffd0a8");
          flame.addColorStop(1, "rgba(255,80,0,0)");
          ctx.fillStyle = flame;
          ctx.fillRect(shot.x + shot.w / 2 - 2, shot.y + shot.h - 2, 4, 10);
        } else {
          ctx.save();
          ctx.shadowColor = shot.rapid ? "#5ce1ff" : "#ffe08a";
          ctx.shadowBlur = 8;
          const bolt = ctx.createLinearGradient(shot.x, shot.y, shot.x, shot.y + shot.h);
          bolt.addColorStop(0, "#ffffff");
          bolt.addColorStop(0.4, shot.rapid ? "#9af7ff" : "#ffe7a8");
          bolt.addColorStop(1, shot.rapid ? "#1aa7ff" : "#d6b36a");
          ctx.fillStyle = bolt;
          roundRect(shot.x, shot.y, shot.w, shot.h, 1.2);
          ctx.fill();
          ctx.restore();
        }
      });

      state.enemyShots.forEach(function (bomb) {
        ctx.save();
        ctx.shadowColor = "#ff3d7f";
        ctx.shadowBlur = 8;
        const g = ctx.createLinearGradient(bomb.x, bomb.y, bomb.x, bomb.y + bomb.h);
        g.addColorStop(0, "#ffd0e6");
        g.addColorStop(1, "#ff3d7f");
        ctx.fillStyle = g;
        roundRect(bomb.x, bomb.y, bomb.w, bomb.h, 1.2);
        ctx.fill();
        ctx.restore();
      });

      state.waves.forEach(function (w) {
        ctx.globalAlpha = Math.max(0, 1 - w.r / w.max);
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      state.booms.forEach(function (b) {
        ctx.globalAlpha = Math.max(0, b.t / 420);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r || 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      ctx.font = "700 8px Orbitron, ui-sans-serif, sans-serif";
      state.floaters.forEach(function (f) {
        ctx.globalAlpha = Math.max(0, f.t / 800);
        ctx.fillStyle = "#e7fbff";
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      });

      if (state.status !== "lost") drawFighter(state.player);

      const scan = ctx.createLinearGradient(0, 0, 0, worldH);
      scan.addColorStop(0, "rgba(255,255,255,0.03)");
      scan.addColorStop(0.5, "rgba(255,255,255,0)");
      scan.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = scan;
      ctx.fillRect(0, 0, worldW, worldH);

      if (state.flash > 0) {
        ctx.fillStyle = "rgba(124,240,255," + (0.06 + state.flash / 2000) + ")";
        ctx.fillRect(0, 0, worldW, worldH);
      }
    }

    function loop(ts) {
      if (!running) return;
      const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
      last = ts;
      update(dt);
      draw();
      raf = global.requestAnimationFrame(loop);
    }

    function start(levelId) {
      stop();
      resize();
      spawnLevel(levelId);
      running = true;
      paused = false;
      last = global.performance.now();
      if (options.onHud) options.onHud(state);
      raf = global.requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      global.cancelAnimationFrame(raf);
    }

    global.addEventListener("resize", function () {
      if (!running) return;
      resize();
    });

    return {
      start: start,
      stop: stop,
      pause: function () { paused = true; },
      resume: function () { paused = false; },
      isPaused: function () { return paused; },
      setMuted: function (value) { muted = value; },
      isMuted: function () { return muted; },
      input: input,
      fire: firePlayer,
      bomb: useBomb,
      tap: function (clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const x = (clientX - rect.left) * worldW / rect.width;
        const y = (clientY - rect.top) * worldH / rect.height;
        return tapWorld(x, y);
      },
      levels: LEVELS,
      resize: resize
    };
  }

  global.SavageArcade = { createGame: createGame, LEVELS: LEVELS };
})(window);
