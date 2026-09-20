(function () {
  const screens = {
    title: document.getElementById("screen-title"),
    game: document.getElementById("screen-game"),
    about: document.getElementById("screen-about"),
    projects: document.getElementById("screen-projects"),
    contact: document.getElementById("screen-contact")
  };

  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const overlayActions = document.getElementById("overlay-actions");
  const scoreEl = document.getElementById("hud-score");
  const livesEl = document.getElementById("hud-lives");
  const levelEl = document.getElementById("hud-level");
  const missionEl = document.getElementById("hud-mission");
  const muteBtn = document.getElementById("btn-mute");
  const pauseBtn = document.getElementById("btn-pause");

  const game = SavageArcade.createGame({
    canvas: document.getElementById("game-canvas"),
    onHud: function (state) {
      scoreEl.textContent = String(state.score).padStart(4, "0");
      livesEl.textContent = String(Math.max(0, state.lives));
      levelEl.textContent = "L" + state.level.id;
      missionEl.textContent = state.level.name;
      const bombsEl = document.getElementById("hud-bombs");
      const bombBtn = document.getElementById("ctrl-bomb");
      const rapidWrap = document.getElementById("hud-rapid-wrap");
      const rapidEl = document.getElementById("hud-rapid");
      if (bombsEl) bombsEl.textContent = String(state.heldBombs || 0);
      if (bombBtn) {
        bombBtn.classList.toggle("is-empty", !state.heldBombs);
        bombBtn.textContent = "BOMB " + (state.heldBombs || 0);
      }
      if (rapidWrap && rapidEl) {
        const ms = (state.player && state.player.rapid) || 0;
        rapidWrap.classList.toggle("is-on", ms > 0);
        rapidEl.textContent = (ms / 1000).toFixed(1);
      }
    },
    onWin: function (state) {
      SavageProgress.clearLevel(state.level.id);
      showOverlay(
        "Wave cleared",
        "You unlocked " + state.level.rewardLabel + ".",
        [
          { label: "Continue to " + state.level.rewardLabel, primary: true, href: "#" + state.level.reward }
        ]
      );
    },
    onLose: function (state) {
      showOverlay(
        "System down",
        "Retry the wave, or skip to " + state.level.rewardLabel + ".",
        [
          { label: "Retry", primary: true, action: function () { startLevel(state.level.id); } },
          { label: "Skip to " + state.level.rewardLabel, action: function () {
            SavageProgress.unlock(state.level.reward);
            location.hash = "#" + state.level.reward;
          }}
        ]
      );
    }
  });

  let currentLevel = 1;
  let overlayOpen = false;

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle("active", key === name);
    });
    const scrolling = name === "about" || name === "projects" || name === "contact";
    document.body.classList.toggle("allow-scroll", scrolling);
    if (name !== "game") {
      game.stop();
      hideOverlay();
    }
    if (scrolling) window.scrollTo(0, 0);
    refreshLocks();
  }

  function hideOverlay() {
    overlayOpen = false;
    overlay.classList.remove("show");
    overlay.hidden = true;
  }

  function showOverlay(title, copy, actions) {
    overlayOpen = true;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    overlayActions.innerHTML = "";
    actions.forEach(function (item) {
      const el = document.createElement(item.href ? "a" : "button");
      el.className = "button " + (item.primary ? "button-primary" : "button-secondary");
      el.textContent = item.label;
      if (item.href) el.href = item.href;
      else el.addEventListener("click", item.action);
      overlayActions.appendChild(el);
    });
    overlay.hidden = false;
    overlay.classList.add("show");
  }

  function startLevel(id) {
    currentLevel = id;
    hideOverlay();
    showScreen("game");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        game.start(id);
        game.resize();
      });
    });
  }

  function refreshLocks() {
    document.querySelectorAll("[data-requires]").forEach(function (el) {
      const page = el.getAttribute("data-requires");
      const open = SavageProgress.isUnlocked(page);
      el.classList.toggle("locked", !open);
      if (el.tagName === "A") {
        if (open) el.setAttribute("href", "#" + page);
        else el.removeAttribute("href");
      }
    });
    document.querySelectorAll("[data-unlock-chip]").forEach(function (el) {
      el.classList.toggle("ready", SavageProgress.isUnlocked(el.getAttribute("data-unlock-chip")));
    });
    const play = document.getElementById("btn-play");
    if (play) {
      const next = SavageProgress.nextLockedLevel();
      play.textContent = SavageProgress.isCleared(3) ? "Play again" : (next === 1 ? "Play" : "Continue");
    }
    document.querySelectorAll("[data-next-cta]").forEach(function (el) {
      const page = el.getAttribute("data-next-cta");
      const labels = { projects: "Projects", contact: "Contact" };
      if (SavageProgress.isUnlocked(page)) {
        el.setAttribute("href", "#" + page);
        el.textContent = "View " + (labels[page] || page);
      }
    });
  }

  function route() {
    const hash = (location.hash || "#title").replace("#", "");
    const parts = hash.split("/");
    const name = parts[0] || "title";

    if (name === "play") {
      const requested = parseInt(parts[1], 10) || SavageProgress.nextLockedLevel();
      startLevel(requested);
      return;
    }

    if (name === "about" || name === "projects" || name === "contact") {
      if (!SavageProgress.isUnlocked(name)) {
        location.replace("#play/" + SavageProgress.playLevelFor(name));
        return;
      }
      showScreen(name);
      return;
    }

    showScreen("title");
    refreshLocks();
  }

  function bindHold(el, key) {
    if (!el) return;
    function down(ev) {
      ev.preventDefault();
      el.classList.add("is-down");
      try { el.setPointerCapture(ev.pointerId); } catch (err) {}
      game.input[key] = true;
      if (key === "fire") game.fire();
    }
    function up() {
      el.classList.remove("is-down");
      game.input[key] = false;
    }
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
  }

  bindHold(document.getElementById("ctrl-left"), "left");
  bindHold(document.getElementById("ctrl-right"), "right");

  const bombCtrl = document.getElementById("ctrl-bomb");
  if (bombCtrl) {
    bombCtrl.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      game.bomb();
    });
  }

  const canvas = document.getElementById("game-canvas");
  canvas.addEventListener("pointerdown", function (ev) {
    if (!screens.game.classList.contains("active")) return;
    game.tap(ev.clientX, ev.clientY);
  });

  document.getElementById("btn-play").addEventListener("click", function () {
    location.hash = "#play/" + SavageProgress.nextLockedLevel();
  });

  pauseBtn.addEventListener("click", function () {
    if (overlayOpen && game.isPaused()) {
      hideOverlay();
      game.resume();
      pauseBtn.textContent = "II";
      return;
    }
    game.pause();
    pauseBtn.textContent = ">";
    showOverlay("Paused", "Take a breath. The bugs can wait.", [
      { label: "Resume", primary: true, action: function () { hideOverlay(); game.resume(); pauseBtn.textContent = "II"; } },
      { label: "Quit to title", action: function () { location.hash = "#title"; } }
    ]);
  });

  muteBtn.addEventListener("click", function () {
    game.setMuted(!game.isMuted());
    muteBtn.textContent = game.isMuted() ? "Sound" : "Mute";
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") game.input.left = true;
    if (ev.code === "ArrowRight" || ev.code === "KeyD") game.input.right = true;
    if (ev.code === "Space" || ev.code === "KeyB" || ev.code === "ShiftLeft" || ev.code === "ShiftRight") {
      ev.preventDefault();
      game.bomb();
    }
    if (ev.code === "Enter" && screens.title.classList.contains("active")) {
      document.getElementById("btn-play").click();
    }
    if (ev.code === "Escape" && screens.game.classList.contains("active")) {
      pauseBtn.click();
    }
  });

  document.addEventListener("keyup", function (ev) {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") game.input.left = false;
    if (ev.code === "ArrowRight" || ev.code === "KeyD") game.input.right = false;

  });

  document.addEventListener("touchmove", function (ev) {
    if (screens.game.classList.contains("active")) ev.preventDefault();
  }, { passive: false });

  window.addEventListener("hashchange", route);
  route();
})();
