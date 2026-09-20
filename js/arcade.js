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
    }
  };

  const LEVELS = {
    1: {
      id: 1,
      name: "Clear the Bugs",
      reward: "about",
      rewardLabel: "About Dan",
      rows: [{ type: "bug", count: 5 }],
      stepMs: 720,
      minStepMs: 420,
      drop: 10,
      fireChance: 0,
      maxPlayerShots: 1,
      cooldown: 220
    },
    2: {
      id: 2,
      name: "Ship the Work",
      reward: "projects",
      rewardLabel: "Projects",
      rows: [
        { type: "ticket", count: 6 },
        { type: "scope", count: 6 },
        { type: "form", count: 6 }
      ],
      stepMs: 560,
      minStepMs: 240,
      drop: 12,
      fireChance: 0.012,
      maxPlayerShots: 1,
      cooldown: 260
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
      stepMs: 420,
      minStepMs: 150,
      drop: 14,
      fireChance: 0.02,
      maxPlayerShots: 2,
      cooldown: 240
    }
  };

  function px(sprite, frame, x, y, size, ctx, color) {
    const rows = sprite.frames[frame % sprite.frames.length];
    ctx.fillStyle = color || sprite.color;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === "1") ctx.fillRect(x + c * size, y + r * size, size, size);
      }
    }
  }

  const UNIT = 3;

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
    const input = { left: false, right: false, fire: false };

    let running = false;
    let paused = false;
    let muted = false;
    let raf = 0;
    let last = 0;
    let audio;
    let state = null;
    let dpr = 1;
    let worldW = 360;
    let worldH = 480;
    let scale = 1;

    function tone(freq, dur, type) {
      if (muted) return;
      try {
        audio = audio || new (global.AudioContext || global.webkitAudioContext)();
        if (audio.state === "suspended") audio.resume();
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = type || "square";
        osc.frequency.value = freq;
        gain.gain.value = 0.04;
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
      let w = Math.round(rect.width || parent.clientWidth || 0);
      let h = Math.round(rect.height || parent.clientHeight || 0);
      if (w < 32) w = global.innerWidth || 360;
      if (h < 32) h = Math.max(160, (global.innerHeight || 640) - 180);
      dpr = Math.min(global.devicePixelRatio || 1, 2);
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
      const cell = 42;
      const top = 28;
      level.rows.forEach(function (row, r) {
        const totalW = row.count * cell;
        const startX = Math.max(8, (worldW - totalW) / 2);
        for (let i = 0; i < row.count; i++) {
          const dim = spriteDim(row.type);
          invaders.push({
            type: row.type,
            x: startX + i * cell,
            y: top + r * 32,
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
        invaders: invaders,
        dir: 1,
        stepMs: level.stepMs,
        stepAcc: 0,
        frame: 0,
        frameAcc: 0,
        player: { x: worldW / 2 - ship.w / 2, y: 0, w: ship.w, h: ship.h, cooldown: 0 },
        shots: [],
        bombs: [],
        booms: [],
        stars: Array.from({ length: 48 }, function () {
          return { x: Math.random() * worldW, y: Math.random() * 600, s: Math.random() * 1.4 + 0.3, v: Math.random() * 12 + 6 };
        }),
        status: "playing",
        flash: 0
      };
    }

    function living() {
      return state.invaders.filter(function (inv) { return inv.alive; });
    }

    function firePlayer() {
      if (!state || state.status !== "playing") return;
      if (state.player.cooldown > 0) return;
      const current = state.shots.filter(function (s) { return s.friendly; }).length;
      if (current >= state.level.maxPlayerShots) return;
      state.shots.push({ x: state.player.x + state.player.w / 2 - 1, y: state.player.y - 8, vy: -260, friendly: true, w: 2, h: 10 });
      state.player.cooldown = state.level.cooldown;
      tone(620, 0.08);
    }

    function hit(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function explode(x, y, color) {
      for (let i = 0; i < 8; i++) {
        state.booms.push({
          x: x, y: y,
          vx: (Math.random() - 0.5) * 80,
          vy: (Math.random() - 0.5) * 80,
          t: 280,
          color: color
        });
      }
    }

    function loseLife() {
      state.lives -= 1;
      state.flash = 180;
      tone(90, 0.2, "sawtooth");
      state.bombs = [];
      state.shots = [];
      if (state.lives <= 0) {
        state.status = "lost";
        if (options.onLose) options.onLose(state);
      }
    }

    function update(dt) {
      if (!state || state.status !== "playing" || paused) return;
      const p = state.player;
      p.y = worldH - p.h - 12;
      const speed = 170;
      if (input.left) p.x -= speed * dt;
      if (input.right) p.x += speed * dt;
      p.x = Math.max(4, Math.min(worldW - p.w - 4, p.x));
      if (input.fire) firePlayer();
      p.cooldown = Math.max(0, p.cooldown - dt * 1000);

      state.frameAcc += dt * 1000;
      if (state.frameAcc > 420) {
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

      state.shots.forEach(function (shot) { shot.y += shot.vy * dt; });
      state.shots = state.shots.filter(function (shot) { return shot.y > -12 && shot.y < worldH + 12; });

      const alive = living();
      const total = state.invaders.length;
      const remainRatio = alive.length / Math.max(1, total);
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
        tone(140 + alive.length * 4, 0.04, "triangle");
      }

      if (alive.length && state.level.fireChance > 0 && Math.random() < state.level.fireChance) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        state.bombs.push({ x: shooter.x + shooter.w / 2 - 1, y: shooter.y + shooter.h, vy: 90 + state.level.id * 20, w: 2, h: 8, friendly: false });
      }

      state.bombs.forEach(function (bomb) { bomb.y += bomb.vy * dt; });
      state.bombs = state.bombs.filter(function (bomb) { return bomb.y < worldH + 10; });

      state.shots.forEach(function (shot) {
        if (!shot.friendly) return;
        alive.forEach(function (inv) {
          if (!inv.alive) return;
          if (hit({ x: shot.x, y: shot.y, w: shot.w, h: shot.h }, { x: inv.x, y: inv.y, w: inv.w, h: inv.h })) {
            inv.alive = false;
            shot.y = -99;
            state.score += 10 * state.level.id;
            explode(inv.x + inv.w / 2, inv.y + inv.h / 2, SPRITES[inv.type].color);
            tone(320, 0.1);
          }
        });
      });

      const playerBox = { x: p.x, y: p.y, w: p.w, h: p.h };
      state.bombs.forEach(function (bomb) {
        if (hit(bomb, playerBox)) {
          bomb.y = worldH + 40;
          explode(p.x + p.w / 2, p.y, "#f4e0b0");
          loseLife();
        }
      });

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
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, worldW, worldH);
      state.stars.forEach(function (star) {
        ctx.fillStyle = star.s > 1 ? "rgba(244,224,176,0.7)" : "rgba(255,255,255,0.35)";
        ctx.fillRect(star.x, star.y, star.s, star.s);
      });
      living().forEach(function (inv) {
        px(SPRITES[inv.type], state.frame, inv.x, inv.y, UNIT, ctx);
      });
      state.shots.forEach(function (shot) {
        ctx.fillStyle = shot.friendly ? "#f4e0b0" : "#ff7a7a";
        ctx.fillRect(shot.x, shot.y, shot.w, shot.h);
      });
      state.bombs.forEach(function (bomb) {
        ctx.fillStyle = "#ff7a7a";
        ctx.fillRect(bomb.x, bomb.y, bomb.w, bomb.h);
      });
      state.booms.forEach(function (b) {
        ctx.globalAlpha = Math.max(0, b.t / 280);
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, 2, 2);
        ctx.globalAlpha = 1;
      });
      if (state.status !== "lost") px(SPRITES.player, 0, state.player.x, state.player.y, UNIT, ctx);
      if (state.flash > 0) {
        ctx.fillStyle = "rgba(255,122,122,0.12)";
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
      const yRatio = state ? (state.player.y || 0) : 0;
      resize();
      if (state) state.player.y = worldH - 36;
      void yRatio;
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
      levels: LEVELS,
      resize: resize
    };
  }

  global.SavageArcade = { createGame: createGame, LEVELS: LEVELS };
})(window);
