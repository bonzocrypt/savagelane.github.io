(function (global) {
  const KEY = "savagelane.arcade.v1";

  const PAGES = {
    1: "about",
    2: "projects",
    3: "contact"
  };

  function empty() {
    return {
      unlocked: { about: false, projects: false, contact: false },
      cleared: { 1: false, 2: false, 3: false }
    };
  }

  function load() {
    try {
      const raw = global.localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw);
      const base = empty();
      return {
        unlocked: { ...base.unlocked, ...(parsed.unlocked || {}) },
        cleared: { ...base.cleared, ...(parsed.cleared || {}) }
      };
    } catch (err) {
      return empty();
    }
  }

  function save(state) {
    global.localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  }

  function isUnlocked(page) {
    return !!load().unlocked[page];
  }

  function isCleared(level) {
    return !!load().cleared[level];
  }

  function unlock(page) {
    const state = load();
    if (page && Object.prototype.hasOwnProperty.call(state.unlocked, page)) {
      state.unlocked[page] = true;
    }
    return save(state);
  }

  function clearLevel(level) {
    const state = load();
    const page = PAGES[level];
    state.cleared[level] = true;
    if (page) state.unlocked[page] = true;
    return save(state);
  }

  function requiredLevelFor(page) {
    if (page === "about") return 1;
    if (page === "projects") return 2;
    if (page === "contact") return 3;
    return 1;
  }

  function playLevelFor(page) {
    if (page === "about") return 1;
    if (page === "projects") return isUnlocked("about") ? 2 : 1;
    if (page === "contact") {
      if (isUnlocked("projects")) return 3;
      if (isUnlocked("about")) return 2;
      return 1;
    }
    return 1;
  }

  function nextLockedLevel() {
    if (!isCleared(1)) return 1;
    if (!isCleared(2)) return 2;
    if (!isCleared(3)) return 3;
    return 1;
  }

  global.SavageProgress = {
    PAGES,
    load,
    save,
    empty,
    isUnlocked,
    isCleared,
    unlock,
    clearLevel,
    requiredLevelFor,
    playLevelFor,
    nextLockedLevel
  };
})(window);
