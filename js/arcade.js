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
    }
  };

  const LEVELS = {
    1: {
      id: 1,
      name: "Clear the Bugs",
      reward: "about",
      rewardLabel: "About Dan",
      rows: [
        { type: "bug", count: 6 },
        { type: "bug", count: 6 }
      ],
      stepMs: 560,
      minStepMs: 260,
      drop: 12,
      fireChance: 0.007,
      maxPlayerShots: 1,
      cooldown: 200,
      pickupChance: 0.32,
      bombRadius: 118
    },
    2: {
      id: 2,
      name: "Ship the Work",
      reward: "projects",
      rewardLabel: "Projects",
      rows: [
        { type: "ticket", count: 7 },
        { type: "scope", count: 7 },
        { type: "form", count: 7 }
      ],
      stepMs: 440,
      minStepMs: 160,
      drop: 14,
      fireChance: 0.018,
      maxPlayerShots: 1,
      cooldown: 230,
      pickupChance: 0.22,
      bombRadius: 132
    },
    3: {
      id: 3,
      name: "Open the Channel",
      reward: "contact",
      rewardLabel: "Contact",
      rows: [
        { type: "mail", count: 7 },
        { type: "meeting", count: 7 },
        { type: "ticket", count: 7 },
        { type: "bug", count: 7 }
      ],
      stepMs: 330,
      minStepMs: 105,
      drop: 16,
      fireChance: 0.03,
      maxPlayerShots: 2,
      cooldown: 210,
      pickupChance: 0.16,
      bombRadius: 150
    }
  };

  const UNIT = 3;
  const MAX_BOMBS = 3;

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

  function spriteDim(type) {
    const size = spriteSize(type);
    return { w: size.cols * UNIT, h: size.rows * UNIT };
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
      const cell = 40;
      const top = 34;
      level.rows.forEach(function (row, r) {
        const totalW = row.count * cell;
        const startX = Math.max(8, (worldW - totalW) / 2);
        for (let i = 0; i < row.count; i++) {
          const dim = spriteDim(row.type);
          invaders.push({
            type: row.type,
            x: startX + i * cell,
            y: top + r * 30,
            w: dim.w,
            h: dim.h,
            alive: true
          });
        }
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
        player: { x: worldW / 2 - ship.w / 2, y: 0, w: ship.w, h: ship.h, cooldown: 0, iframe: 0 },
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

    function killInvader(inv, points) {
      if (!inv.alive) return;
      inv.alive = false;
      const pts = points || (10 * state.level.id);
      state.score += pts;
      explode(inv.x + inv.w / 2, inv.y + inv.h / 2, SPRITES[inv.type].color, 12);
      floater(inv.x, inv.y, "+" + pts);
      tone(320, 0.09);
      if (Math.random() < state.level.pickupChance) {
        const dim = spriteDim("bomb");
        state.pickups.push({
          x: inv.x + inv.w / 2 - dim.w / 2,
          y: inv.y,
          w: dim.w,
          h: dim.h,
          vy: 42,
          t: 0
        });
      }
    }

    function firePlayer() {
      if (!state || state.status !== "playing") return;
      if (state.player.cooldown > 0) return;
      const current = state.shots.filter(function (s) { return s.kind === "shot"; }).length;
      if (current >= state.level.maxPlayerShots) return;
      state.shots.push({
        x: state.player.x + state.player.w / 2 - 1.5,
        y: state.player.y - 8,
        vy: -280,
        w: 3,
        h: 11,
        kind: "shot"
      });
      state.player.cooldown = state.level.cooldown;
      tone(620, 0.07);
    }

    function useBomb() {
      if (!state || state.status !== "playing" || paused) return;
      if (state.heldBombs <= 0) {
        tone(110, 0.08, "sawtooth", 0.03);
        return;
      }
      state.heldBombs -= 1;
      const p = state.player;
      const cx = p.x + p.w / 2;
      const cy = p.y - 8;
      const radius = state.level.bombRadius;
      wave(cx, cy, radius + 20, "#ffb347");
      wave(cx, cy, radius * 0.55, "#fff1c8");
      state.flash = 220;
      state.shake = 220;
      tone(90, 0.18, "sawtooth", 0.06);
      tone(240, 0.22, "square", 0.05);
      living().forEach(function (inv) {
        const dx = inv.x + inv.w / 2 - cx;
        const dy = inv.y + inv.h / 2 - cy;
        if (Math.sqrt(dx * dx + dy * dy) <= radius) killInvader(inv, 20 * state.level.id);
      });
      if (state.saucer) {
        const dx = state.saucer.x + state.saucer.w / 2 - cx;
        const dy = state.saucer.y + state.saucer.h / 2 - cy;
        if (Math.sqrt(dx * dx + dy * dy) <= radius) {
          explode(state.saucer.x + 10, state.saucer.y + 4, "#f4e0b0", 16);
          state.score += 150;
          floater(state.saucer.x, state.saucer.y, "+150");
          state.saucer = null;
        }
      }
      state.enemyShots = [];
      if (options.onHud) options.onHud(state);
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
      if (input.fire) firePlayer();
      if (input.bomb) {
        useBomb();
        input.bomb = false;
      }
      p.cooldown = Math.max(0, p.cooldown - dt * 1000);
      p.iframe = Math.max(0, p.iframe - dt * 1000);
      state.shake = Math.max(0, state.shake - dt * 1000);

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
          vx: left ? 70 : -70
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
        alive.forEach(function (inv) {
          inv.x += state.dir * 8;
          if (inv.x < 6 || inv.x + inv.w > worldW - 6) hitEdge = true;
        });
        if (hitEdge) {
          state.dir *= -1;
          alive.forEach(function (inv) {
            inv.x += state.dir * 8;
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
          vy: 95 + state.level.id * 28,
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
        alive.forEach(function (inv) {
          if (!inv.alive) return;
          if (hit(shot, inv)) {
            shot.y = -99;
            killInvader(inv);
          }
        });
        if (state.saucer && hit(shot, state.saucer)) {
          shot.y = -99;
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
        if (hit(item, playerBox)) {
          item.y = worldH + 40;
          if (state.heldBombs < MAX_BOMBS) {
            state.heldBombs += 1;
            floater(p.x, p.y - 12, "BOMB");
            tone(740, 0.1, "triangle");
          } else {
            state.score += 50;
            floater(p.x, p.y - 12, "+50");
          }
        }
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
        px(SPRITES[inv.type], state.frame, inv.x, inv.y, UNIT, ctx);
      });
      if (state.saucer) px(SPRITES.saucer, 0, state.saucer.x, state.saucer.y, UNIT, ctx);
      state.pickups.forEach(function (item) {
        const glow = 0.55 + Math.sin(item.t / 90) * 0.45;
        ctx.globalAlpha = 0.25 + glow * 0.25;
        ctx.fillStyle = "#ffb347";
        ctx.fillRect(item.x - 2, item.y - 2, item.w + 4, item.h + 4);
        ctx.globalAlpha = 1;
        px(SPRITES.bomb, 0, item.x, item.y, UNIT, ctx);
      });
      state.shots.forEach(function (shot) {
        ctx.fillStyle = "#fff4cc";
        ctx.fillRect(shot.x, shot.y, shot.w, shot.h);
        ctx.fillStyle = "#d6b36a";
        ctx.fillRect(shot.x, shot.y + shot.h - 3, shot.w, 3);
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
          px(SPRITES.player, 0, state.player.x, state.player.y, UNIT, ctx);
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
      levels: LEVELS,
      resize: resize
    };
  }

  global.SavageArcade = { createGame: createGame, LEVELS: LEVELS };
})(window);
