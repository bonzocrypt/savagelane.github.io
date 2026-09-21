(function (global) {
  const SPRITES = {
    bug: {
      color: "#ff7a7a",
      frames: [
        ["00100000100","00010001000","00111111100","01101110110","11111111111","10111111101","10100000101","00011011000"],
        ["00100000100","10100000101","00111111100","01101110110","11111111111","00111111100","00010001000","00100000100"]
      ]
    },
    ticket: {
      color: "#8ad7ff",
      frames: [
        ["11111111111","10000000001","10111011101","10000000001","10111111101","10000000001","10111011101","11111111111"],
        ["01111111110","10000000001","10111011101","10000000001","10111111101","10000000001","10111011101","01111111110"]
      ]
    },
    scope: {
      color: "#c084fc",
      frames: [
        ["00111111100","01111111110","11101110111","11111111111","01111111110","00111111100","01000000010","10000000001"],
        ["00111111100","01111111110","11110101111","11111111111","01111111110","00111111100","00100000100","01000000010"]
      ]
    },
    form: {
      color: "#91f5c7",
      frames: [
        ["00111111100","01000000010","01110111010","01000000010","01111111010","01000000010","01110111010","00111111100"],
        ["00111111100","01000000010","01011101110","01000000010","01011111110","01000000010","01011101110","00111111100"]
      ]
    },
    mail: {
      color: "#f4e0b0",
      frames: [
        ["11111111111","11000000011","10100000101","10010001001","10001010001","10000100001","10000000001","11111111111"],
        ["11111111111","10000000001","11000000011","10100000101","10010001001","10001010001","10000100001","11111111111"]
      ]
    },
    meeting: {
      color: "#d6b36a",
      frames: [
        ["01000000010","11111111111","10000000001","10110110101","10000000001","10110110101","10000000001","11111111111"],
        ["00100000100","11111111111","10000000001","10110110101","10000000001","10110110101","10000000001","11111111111"]
      ]
    },
    player: {
      color: "#f4e0b0",
      frames: [
        ["0000001000000","0000011100000","0000011100000","0000111110000","0011111111100","0111111111110","1101101011011","1001000001001"]
      ]
    },
    saucer: {
      color: "#f4e0b0",
      frames: [
        ["000111111000","011111111110","111010101111","011111111110","001011110100"]
      ]
    },
    bomb: {
      color: "#ffb347",
      frames: [
        ["00011000","00111100","00011000","01111110","11111111","11111111","01111110","00111100"]
      ]
    },
    rapid: {
      color: "#8ad7ff",
      frames: [
        ["00001000","00011000","00111110","01111000","00011110","00001100","00111000","00010000"]
      ]
    }
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
      stepMs: 280,
      minStepMs: 110,
      stepPx: 10,
      drop: 14,
      fireChance: 0.01,
      maxPlayerShots: 36,
      cooldown: 80,
      shotSpeed: 280,
      pickupChance: 0.28
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
      stepMs: 200,
      minStepMs: 78,
      stepPx: 11,
      drop: 15,
      fireChance: 0.022,
      maxPlayerShots: 36,
      cooldown: 80,
      shotSpeed: 300,
      pickupChance: 0.2
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
      stepMs: 145,
      minStepMs: 52,
      stepPx: 12,
      drop: 16,
      fireChance: 0.034,
      maxPlayerShots: 36,
      cooldown: 80,
      shotSpeed: 320,
      pickupChance: 0.16
    }
  };

  const UNIT = 3;
  const MAX_BOMBS = 3;
  const RAPID_MULT = 10;

  function px(sprite, frame, x, y, size, ctx, color) {
    const rows = sprite.frames[frame % sprite.frames.length];
    ctx.fillStyle = color || sprite.color;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === "1") ctx.fillRect(x + c * size, y + r * size, size, size);
      }
    }
  }

  function spriteSize(type) {
    const rows = SPRITES[type].frames[0];
    return { cols: rows[0].length, rows: rows.length };
  }

  function spriteDim(type, unit) {
    const size = spriteSize(type);
    const u = unit || UNIT;
    return { w: size.cols * u, h: size.rows * u };
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
      if (state && state.player) state.player.y = worldH - state.player.h - 12;
    }

    function spawnLevel(id) {
      const level = LEVELS[id] || LEVELS[1];
      const invaders = [];
      let y = 28;
      level.rows.forEach(function (row) {
        const unit = row.unit || UNIT;
        const dim = spriteDim(row.type, unit);
        const cell = Math.max(dim.w + 6, 34);
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
            alive: true
          });
        }
        y += dim.h + 8;
      });
      const ship = spriteDim("player");
      state = {
        level: level,
        score: 0,
        lives: 3,
        heldBombs: 0,
        invaders: invaders,
        dir: 1,
        stepMs: level.stepMs,
        stepAcc: 0,
        frame: 0,
        frameAcc: 0,
        player: { x: worldW / 2 - ship.w / 2, y: 0, w: ship.w, h: ship.h, cooldown: 0, iframe: 0, rapid: 0 },
        shots: [],
        enemyShots: [],
        pickups: [],
        booms: [],
        waves: [],
        floaters: [],
        saucer: null,
        saucerIn: 4500 + Math.random() * 2500,
        stars: Array.from({ length: 56 }, function () {
          return { x: Math.random() * worldW, y: Math.random() * 600, s: Math.random() * 1.4 + 0.3, v: Math.random() * 14 + 6 };
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
      const count = n || 10;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const spd = 40 + Math.random() * 90;
        state.booms.push({
          x: x, y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          t: 340 + Math.random() * 120,
          color: color
        });
      }
    }

    function floater(x, y, text) {
      state.floaters.push({ x: x, y: y, text: text, t: 700 });
    }

    function wave(x, y, maxR, color) {
      state.waves.push({ x: x, y: y, r: 6, max: maxR, color: color || "#ffb347" });
    }

    function finishKill(inv, points) {
      inv.alive = false;
      inv.hp = 0;
      const pts = points || (10 * state.level.id * (inv.maxHp > 1 ? 3 : 1));
      state.score += pts;
      explode(inv.x + inv.w / 2, inv.y + inv.h / 2, SPRITES[inv.type].color, inv.maxHp > 1 ? 18 : 12);
      floater(inv.x, inv.y, "+" + pts);
      tone(320, 0.09);
      if (Math.random() < state.level.pickupChance) {
        const kind = Math.random() < 0.55 ? "bomb" : "rapid";
        const dim = spriteDim(kind);
        state.pickups.push({
          kind: kind,
          x: inv.x + inv.w / 2 - dim.w / 2,
          y: inv.y,
          w: dim.w,
          h: dim.h,
          vy: 48,
          t: 0
        });
      }
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
      explode(inv.x + inv.w / 2, inv.y + inv.h / 2, SPRITES[inv.type].color, 5);
      tone(210, 0.05, "square", 0.03);
    }

    function firePlayer() {
      if (!state || state.status !== "playing") return;
      if (state.player.cooldown > 0) return;
      const rapid = state.player.rapid > 0;
      const maxShots = rapid ? state.level.maxPlayerShots * RAPID_MULT : state.level.maxPlayerShots;
      const current = state.shots.filter(function (s) { return s.kind === "shot"; }).length;
      if (current >= maxShots) return;
      const speed = (state.level.shotSpeed || 560) * (rapid ? 1.35 : 1);
      state.shots.push({
        x: state.player.x + state.player.w / 2 - 1.5,
        y: state.player.y - 8,
        vy: -speed,
        w: 2,
        h: rapid ? 10 : 9,
        kind: "shot",
        rapid: rapid,
        struck: []
      });
      state.player.cooldown = rapid ? state.level.cooldown / RAPID_MULT : state.level.cooldown;
      if (!rapid || current % 4 === 0) tone(rapid ? 780 : 640, 0.03, "square", rapid ? 0.016 : 0.022);
    }

    function collectPickup(item, labelX, labelY) {
      item.y = worldH + 40;
      if (item.kind === "rapid") {
        state.player.rapid = 6000;
        floater(labelX, labelY, "RAPID");
        tone(880, 0.12, "triangle");
        tone(1180, 0.1, "square", 0.03);
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
        vy: -210,
        kind: "rocket",
        struck: [],
        trail: 0
      });
      state.shake = 90;
      wave(x, y, 28, "#ffb347");
      tone(180, 0.12, "square", 0.05);
      tone(420, 0.16, "triangle", 0.04);
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
      p.y = worldH - p.h - 12;
      const speed = 175;
      if (input.left) p.x -= speed * dt;
      if (input.right) p.x += speed * dt;
      p.x = Math.max(4, Math.min(worldW - p.w - 4, p.x));
      firePlayer();
      if (input.bomb) {
        useBomb();
        input.bomb = false;
      }
      p.cooldown = Math.max(0, p.cooldown - dt * 1000);
      p.iframe = Math.max(0, p.iframe - dt * 1000);
      p.rapid = Math.max(0, p.rapid - dt * 1000);
      state.shake = Math.max(0, state.shake - dt * 1000);
      living().forEach(function (inv) {
        inv.hitFlash = Math.max(0, (inv.hitFlash || 0) - dt * 1000);
      });

      state.frameAcc += dt * 1000;
      if (state.frameAcc > 380) {
        state.frameAcc = 0;
        state.frame = 1 - state.frame;
      }

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
          y: 10,
          w: dim.w,
          h: dim.h,
          vx: left ? 110 : -110
        };
        state.saucerIn = 9000 + Math.random() * 5000;
        tone(880, 0.12, "triangle", 0.03);
      }
      if (state.saucer) {
        state.saucer.x += state.saucer.vx * dt;
        if (state.saucer.x < -40 || state.saucer.x > worldW + 40) state.saucer = null;
      }

      state.shots.forEach(function (shot) { shot.y += shot.vy * dt; });
      state.shots = state.shots.filter(function (shot) { return shot.y > -16 && shot.y < worldH + 12; });

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
        tone(140 + alive.length * 3, 0.035, "triangle", 0.025);
      }

      const shooters = bottomShooters(alive);
      if (shooters.length && Math.random() < state.level.fireChance) {
        const shooter = shooters[Math.floor(Math.random() * shooters.length)];
        state.enemyShots.push({
          x: shooter.x + shooter.w / 2 - 1,
          y: shooter.y + shooter.h,
          vy: 150 + state.level.id * 40,
          w: 2,
          h: 8
        });
      }

      state.enemyShots.forEach(function (bomb) { bomb.y += bomb.vy * dt; });
      state.enemyShots = state.enemyShots.filter(function (bomb) { return bomb.y < worldH + 10; });

      state.pickups.forEach(function (item) {
        item.y += item.vy * dt;
        item.t += dt * 1000;
      });
      state.pickups = state.pickups.filter(function (item) { return item.y < worldH + 16; });

      state.shots.forEach(function (shot) {
        if (shot.kind === "rocket") {
          shot.trail = (shot.trail || 0) + 1;
          if (shot.trail % 2 === 0) {
            state.booms.push({
              x: shot.x + shot.w / 2 + (Math.random() - 0.5) * 4,
              y: shot.y + shot.h,
              vx: (Math.random() - 0.5) * 20,
              vy: 40,
              t: 180,
              color: "#ffb347"
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
          explode(state.saucer.x + state.saucer.w / 2, state.saucer.y + 4, "#f4e0b0", 16);
          state.score += 150;
          floater(state.saucer.x, state.saucer.y, "+150");
          tone(980, 0.14, "triangle");
          if (state.heldBombs < MAX_BOMBS) {
            state.heldBombs += 1;
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
            explode(p.x + p.w / 2, p.y, "#f4e0b0", 10);
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
      state.waves.forEach(function (w) { w.r += 220 * dt; });
      state.waves = state.waves.filter(function (w) { return w.r < w.max; });
      state.floaters.forEach(function (f) {
        f.y -= 28 * dt;
        f.t -= dt * 1000;
      });
      state.floaters = state.floaters.filter(function (f) { return f.t > 0; });
      state.flash = Math.max(0, state.flash - dt * 1000);

      if (!living().length && state.status === "playing") {
        state.status = "won";
        tone(520, 0.12);
        tone(740, 0.18);
        if (options.onWin) options.onWin(state);
      }

      if (options.onHud) options.onHud(state);
    }

    function draw() {
      if (!state) return;
      const ox = state.shake ? (Math.random() - 0.5) * 3 : 0;
      const oy = state.shake ? (Math.random() - 0.5) * 3 : 0;
      ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#050507";
      ctx.fillRect(-4, -4, worldW + 8, worldH + 8);
      state.stars.forEach(function (star) {
        ctx.fillStyle = star.s > 1 ? "rgba(244,224,176,0.7)" : "rgba(255,255,255,0.35)";
        ctx.fillRect(star.x, star.y, star.s, star.s);
      });
      living().forEach(function (inv) {
        const color = inv.hitFlash > 0
          ? "#ffffff"
          : (inv.maxHp > 1 && inv.hp < inv.maxHp ? "#ffb0a8" : SPRITES[inv.type].color);
        px(SPRITES[inv.type], state.frame, inv.x, inv.y, inv.unit || UNIT, ctx, color);
      });
      if (state.saucer) px(SPRITES.saucer, 0, state.saucer.x, state.saucer.y, UNIT, ctx);
      state.pickups.forEach(function (item) {
        const kind = item.kind === "rapid" ? "rapid" : "bomb";
        const glow = 0.55 + Math.sin(item.t / 90) * 0.45;
        ctx.globalAlpha = 0.25 + glow * 0.25;
        ctx.fillStyle = SPRITES[kind].color;
        ctx.fillRect(item.x - 2, item.y - 2, item.w + 4, item.h + 4);
        ctx.globalAlpha = 1;
        px(SPRITES[kind], 0, item.x, item.y, UNIT, ctx);
      });
      state.shots.forEach(function (shot) {
        if (shot.kind === "rocket") {
          px(SPRITES.bomb, 0, shot.x, shot.y, UNIT, ctx, "#ffb347");
          ctx.fillStyle = "#ff7a3a";
          ctx.fillRect(shot.x + shot.w / 2 - 1, shot.y + shot.h, 2, 6);
        } else {
          ctx.fillStyle = shot.rapid ? "#c8f4ff" : "#fff4cc";
          ctx.fillRect(shot.x, shot.y, shot.w, shot.h);
          ctx.fillStyle = shot.rapid ? "#8ad7ff" : "#d6b36a";
          ctx.fillRect(shot.x, shot.y + shot.h - 3, shot.w, 3);
        }
      });
      state.enemyShots.forEach(function (bomb) {
        ctx.fillStyle = "#ff7a7a";
        ctx.fillRect(bomb.x, bomb.y, bomb.w, bomb.h);
      });
      state.waves.forEach(function (w) {
        ctx.globalAlpha = Math.max(0, 1 - w.r / w.max);
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      state.booms.forEach(function (b) {
        ctx.globalAlpha = Math.max(0, b.t / 360);
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, 2.2, 2.2);
        ctx.globalAlpha = 1;
      });
      ctx.font = "bold 8px ui-monospace, monospace";
      state.floaters.forEach(function (f) {
        ctx.globalAlpha = Math.max(0, f.t / 700);
        ctx.fillStyle = "#f4e0b0";
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      });
      if (state.status !== "lost") {
        if (state.player.iframe <= 0 || Math.floor(state.player.iframe / 80) % 2 === 0) {
          if (state.player.rapid > 0) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#8ad7ff";
            ctx.fillRect(state.player.x - 3, state.player.y - 3, state.player.w + 6, state.player.h + 6);
            ctx.globalAlpha = 1;
            px(SPRITES.player, 0, state.player.x, state.player.y, UNIT, ctx, "#c8f4ff");
          } else {
            px(SPRITES.player, 0, state.player.x, state.player.y, UNIT, ctx);
          }
        }
      }
      if (state.flash > 0) {
        ctx.fillStyle = "rgba(255,179,71," + (0.08 + state.flash / 1800) + ")";
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
