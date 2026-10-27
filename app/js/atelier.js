/*
 * Atelier — a quiet gallery home screen for webOS TV.
 *
 * Art transition rules:
 *   - two retained <img> layers share the art frame
 *   - baseline JPEG plates, 3840x2160 sources
 *   - the next plate is decoded on the hidden layer during the dwell
 *   - a linear opacity dissolve reveals it over the stationary outgoing plate
 *   - no scale, pan, zoom, tint, or filter on either bitmap
 *   - the outgoing bitmap is released when the dissolve completes
 *   - an opaque black cover remains the fallback for launch and decode failure
 *
 * The library never lists installed apps; it launches the IDs configured in
 * js/config.js. Nothing is uploaded and no network requests are made.
 */
(function () {
  "use strict";

  var CFG = window.ATELIER_CONFIG;
  var state = {
    index: 0,
    ready: false,
    busy: false,
    queue: [],
    focusZone: "dock",
    dockIndex: 0,
    inputFocus: 0,
    appFocus: 0,
    displayFocus: 0,
    displayZone: "rows",
    frameFocus: 0,
    overlay: null,
    returnToApps: null,
    restoreStage: null,
    restoreArmedAt: 0,
    restoreBusy: false,
    okDown: false,
    mode: "full",
    frame: "modern-white",
    idle: false,
    galleryHold: false,
    upHeld: false,
    upHeldAt: 0,
    launching: false,
    dockItems: [],
    catalogItems: [],
    dockUsage: null,
    dockTimer: null,
    dockRefreshTimer: null,
    transitionCount: 0,
    lastDecodeMs: 0,
    lastTransitionMs: 0,
    lastFadeMs: 0,
    lastActivity: Date.now(),
    keyBuffer: "",
    toastTimer: null,
    idleTimer: null,
    clockTimer: null,
    rotateTimer: null,
    preloadTimer: null,
    preloadSrc: null,
    preloadStartedAt: 0,
    front: "a",
    fadeTarget: null,
    fadeStartedAt: 0,
    fadeIncoming: null,
    fadeOutgoing: null,
    fadeTimer: null,
    fadeMidTimer: null,
    fadeEndHandler: null,
    fadeFinish: null
  };

  var el = {};
  var dockButtons = [];
  var inputButtons = [];
  var appButtons = [];
  var displayButtons = [];
  var frameButtons = [];
  var FRAME_COLUMNS = 1;
  /* The band itself is the frame element's border, so one uninterrupted
     moulding wraps all four corners; only the recess is a child. */
  var FRAME_PARTS = '<div class="pf-mouth"></div>';
  var DOCK_USAGE_KEY = "atelier.dockUsage";
  var DOCK_USAGE_VERSION = 1;
  var DOCK_REFRESH_MS = 60000;
  var DOCK_POST_LAUNCH_MS = 1500;
  var DOCK_USAGE_MAX_COUNT = 1000000000;

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function roman(value) {
    var n = Math.max(0, Math.floor(value));
    if (!n) return "";
    var pairs = [
      [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
      [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
      [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
    ];
    var out = "";
    pairs.forEach(function (pair) {
      while (n >= pair[0]) {
        out += pair[1];
        n -= pair[0];
      }
    });
    return out;
  }

  function now() {
    return window.performance && window.performance.now
      ? window.performance.now()
      : Date.now();
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function raf2() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  function plateSrc(plate) {
    return "assets/plates/american/" + plate.slug + ".jpg";
  }

  function otherKey(key) {
    return key === "b" ? "a" : "b";
  }

  function plateFor(key) {
    return key === "b" ? el.plateB : el.plate;
  }

  function frontPlate() {
    return plateFor(state.front);
  }

  function backPlate() {
    return plateFor(otherKey(state.front));
  }

  function setFront(key) {
    var outgoing = frontPlate();
    var incoming = plateFor(key);
    outgoing.classList.remove("is-front");
    incoming.classList.add("is-front");
    state.front = key;
  }

  function resetLayers() {
    state.front = "a";
    el.plate.classList.add("is-front");
    el.plateB.classList.remove("is-front");
    el.plate.style.transition = "none";
    el.plate.style.opacity = "1";
    el.plate.style.zIndex = "0";
    el.plateB.style.transition = "none";
    el.plateB.style.opacity = "0";
    el.plateB.style.zIndex = "1";
    el.plateB.removeAttribute("src");
  }

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (err) {
      return false;
    }
  }

  function cacheDom() {
    el.stage = document.getElementById("stage");
    el.plate = document.getElementById("plate");
    el.plateB = document.getElementById("plate-b");
    el.cover = document.getElementById("cover");
    el.hero = document.getElementById("hero");
    el.title = document.getElementById("art-title");
    el.artist = document.getElementById("art-artist");
    el.year = document.getElementById("art-year");
    el.ordinal = document.getElementById("ordinal");
    el.clockTime = document.getElementById("clock-time");
    el.clockDate = document.getElementById("clock-date");
    el.dock = document.getElementById("dock");
    el.toast = document.getElementById("toast");
    el.inputsOverlay = document.getElementById("inputs-overlay");
    el.inputsRows = document.getElementById("inputs-rows");
    el.allAppsOverlay = document.getElementById("allapps-overlay");
    el.appsGrid = document.getElementById("apps-grid");
    el.displayOverlay = document.getElementById("display-overlay");
    el.displayRows = document.getElementById("display-rows");
    el.displayFull = document.getElementById("display-full");
    el.displayFramed = document.getElementById("display-framed");
    el.displayRestore = document.getElementById("display-restore");
    el.frameGrid = document.getElementById("frame-grid");
    el.pictureFrame = document.getElementById("picture-frame");
    el.restoreConfirm = document.getElementById("restore-confirm");
    el.restoreConfirmCopy = document.getElementById("restore-confirm-copy");
    el.restoreLog = document.getElementById("restore-log");
    el.diagnostics = document.getElementById("diagnostics");
    el.diagGrid = document.getElementById("diag-grid");
    el.plaque = document.getElementById("plaque");
    el.plaqueTitle = document.getElementById("plaque-title");
    el.plaqueArtist = document.getElementById("plaque-artist");
    el.plaqueYear = document.getElementById("plaque-year");
  }

  /* ---------- artwork ---------- */

  function updateCaption(index) {
    var plate = CFG.plates[index];
    el.title.textContent = plate.title;
    el.artist.textContent = plate.artist;
    el.year.textContent = plate.year;
    el.ordinal.textContent = roman(index + 1) + " / " + roman(CFG.plates.length);
    el.plaqueTitle.textContent = plate.title;
    el.plaqueArtist.textContent = plate.artist;
    el.plaqueYear.textContent = plate.year;
  }

  /* ---------- display mode ---------- */

  function readStoredMode() {
    try {
      var raw = window.localStorage.getItem("atelier.displayMode");
      if (raw === "framed" || raw === "full") return raw;
    } catch (err) {
      /* local storage can be unavailable in some TV containers */
    }
    return CFG.displayDefault === "framed" ? "framed" : "full";
  }

  function storeMode(mode) {
    try {
      window.localStorage.setItem("atelier.displayMode", mode);
    } catch (err) {
      /* non-fatal */
    }
  }

  function applyMode(mode) {
    state.mode = mode === "framed" ? "framed" : "full";
    document.body.classList.toggle("mode-framed", state.mode === "framed");
    document.body.classList.toggle("mode-full", state.mode === "full");
    renderDisplayFocus();
    renderFocus();
  }

  function setMode(mode) {
    applyMode(mode);
    storeMode(state.mode);
  }

  /* ---------- picture frame finish ---------- */

  function frameList() {
    return CFG.frames && CFG.frames.length ? CFG.frames : [];
  }

  function frameById(id) {
    var list = frameList();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function currentFrameIndex() {
    var list = frameList();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === state.frame) return i;
    }
    return 0;
  }

  function readStoredFrame() {
    try {
      var raw = window.localStorage.getItem("atelier.frameStyle");
      if (raw && frameById(raw)) return raw;
    } catch (err) {
      /* local storage can be unavailable in some TV containers */
    }
    if (frameById(CFG.frameDefault)) return CFG.frameDefault;
    return frameList().length ? frameList()[0].id : "";
  }

  function storeFrame(id) {
    try {
      window.localStorage.setItem("atelier.frameStyle", id);
    } catch (err) {
      /* non-fatal */
    }
  }

  function buildFrameParts(container) {
    if (!container) return;
    container.innerHTML = FRAME_PARTS;
  }

  function applyFrameStyle(id) {
    var frame = frameById(id) || frameList()[0];
    if (!frame) return;
    state.frame = frame.id;

    frameList().forEach(function (item) {
      document.body.classList.toggle(
        "frame-" + item.id,
        item.id === frame.id
      );
    });

    if (el.pictureFrame) {
      el.pictureFrame.className = "picture-frame is-stage frame-" + frame.id;
    }

    frameButtons.forEach(function (button, index) {
      var item = frameList()[index];
      var selected = !!(item && item.id === frame.id);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    renderDisplayFocus();
  }

  function setFrame(id) {
    applyFrameStyle(id);
    storeFrame(state.frame);
  }

  function swapImage(src, image) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = null;
      image = image || el.plate;

      function cleanup() {
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }

      function settle(fn, value) {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      }

      function decoded() {
        raf2().then(function () {
          settle(resolve);
        });
      }

      function onLoad() {
        if (settled) return;
        if (image.decode) {
          image.decode().then(decoded, function (err) {
            settle(reject, err || new Error("decode failed"));
          });
        } else {
          decoded();
        }
      }

      function onError() {
        settle(reject, new Error("image load failed: " + src));
      }

      // A stuck decode must never leave the cover over the gallery forever.
      // While the app is backgrounded the decoder may legitimately be paused,
      // so extend the watchdog instead of surfacing a false error.
      function armWatchdog() {
        timer = setTimeout(function () {
          if (document.hidden) {
            armWatchdog();
            return;
          }
          settle(reject, new Error("image load timed out: " + src));
        }, 15000);
      }
      armWatchdog();

      image.addEventListener("load", onLoad);
      image.addEventListener("error", onError);
      image.src = src;

      if (image.complete && image.naturalWidth > 0) {
        onLoad();
      }
    });
  }

  function showCover() {
    el.cover.classList.remove("is-hidden");
    // Flush the style so the cover is opaque before the bitmap changes.
    void el.cover.offsetWidth;
  }

  function hideCover() {
    el.cover.classList.add("is-hidden");
  }

  function prepareIncoming(src) {
    var incoming = backPlate();
    var started = now();

    incoming.style.transition = "none";
    incoming.style.opacity = "0";
    incoming.style.zIndex = "1";

    if (incoming.getAttribute("src") === src &&
        incoming.complete && incoming.naturalWidth > 0) {
      state.preloadSrc = src;
      if (incoming.decode) {
        return incoming.decode().then(function () {
          return incoming;
        });
      }
      return Promise.resolve(incoming);
    }

    state.preloadStartedAt = started;
    state.preloadSrc = src;
    return swapImage(src, incoming).then(function () {
      state.lastDecodeMs = now() - started;
      return incoming;
    });
  }

  function preloadNextPlate() {
    if (!state.ready || state.busy || state.overlay || document.hidden) return;

    var target = mod(state.index + 1, CFG.plates.length);
    var src = plateSrc(CFG.plates[target]);
    if (state.preloadSrc === src && state.preloadPromise) return;

    state.preloadPromise = prepareIncoming(src).catch(function (err) {
      console.warn("Atelier could not preload the next plate:", err);
      state.preloadSrc = null;
      state.preloadPromise = null;
      return null;
    });
  }

  function updateFadeCaption() {
    state.fadeMidTimer = null;
    if (state.fadeTarget === null) return;
    updateCaption(state.fadeTarget);
  }

  function finishFade(snap) {
    if (!state.fadeFinish || state.fadeTarget === null) return;

    var incoming = state.fadeIncoming;
    var outgoing = state.fadeOutgoing;

    if (state.fadeTimer) {
      clearTimeout(state.fadeTimer);
      state.fadeTimer = null;
    }
    if (state.fadeMidTimer) {
      clearTimeout(state.fadeMidTimer);
      state.fadeMidTimer = null;
    }
    if (state.fadeEndHandler && incoming) {
      incoming.removeEventListener("transitionend", state.fadeEndHandler, false);
      state.fadeEndHandler = null;
    }

    if (incoming) {
      if (snap) {
        incoming.style.transition = "none";
        incoming.style.opacity = "1";
      }
      incoming.classList.remove("is-fading");
      incoming.style.transition = "none";
      incoming.style.zIndex = "0";
    }
    if (outgoing) {
      outgoing.classList.remove("is-fading");
      outgoing.style.transition = "none";
      outgoing.style.opacity = "0";
      outgoing.style.zIndex = "0";
      // Release the outgoing 4K bitmap instead of retaining both indefinitely.
      outgoing.removeAttribute("src");
    }

    var target = state.fadeTarget;
    var elapsed = now() - state.fadeStartedAt;
    state.fadeTarget = null;
    state.fadeIncoming = null;
    state.fadeOutgoing = null;
    state.fadeFinish = null;
    state.lastFadeMs = elapsed;
    state.lastTransitionMs = elapsed;
    setFront(otherKey(state.front));
    state.index = target;
    state.transitionCount += 1;
    state.preloadSrc = null;
    state.preloadPromise = null;
    state.preloadStartedAt = 0;
    updateCaption(target);
    storeIndex(target);
    state.busy = false;
    scheduleRotation();
    drainQueue();
  }

  function crossfadeTo(target) {
    if (target === state.index) {
      drainQueue();
      return;
    }
    if (state.busy) {
      state.queue.push(target - state.index);
      return;
    }

    state.busy = true;
    if (state.preloadTimer) {
      clearTimeout(state.preloadTimer);
      state.preloadTimer = null;
    }

    var src = plateSrc(CFG.plates[target]);
    var incoming = backPlate();
    var outgoing = frontPlate();
    var prepared;

    if (state.preloadSrc === src && state.preloadPromise) {
      prepared = state.preloadPromise.then(function (ready) {
        if (ready) return ready;
        return prepareIncoming(src);
      });
    } else {
      prepared = prepareIncoming(src);
    }

    prepared.catch(function (err) {
      console.warn("Atelier dissolve decode retry:", err);
      incoming.removeAttribute("src");
      return prepareIncoming(src);
    }).then(function () {
      // Ensure the hidden layer has actually painted before its opacity moves.
      return raf2();
    }).then(function () {
      startFade(target, incoming, outgoing);
    }).catch(function (err) {
      console.error("Atelier plate dissolve failed:", err);
      showToast("Could not load that plate.");
      fallbackTransition(target);
    });
  }

  function startFade(target, incoming, outgoing) {
    var fadeMs = prefersReducedMotion()
      ? 0
      : Math.max(0, Number(CFG.crossfadeMs) || 0);

    incoming.style.transition = "none";
    incoming.style.opacity = "0";
    incoming.style.zIndex = "1";
    outgoing.style.transition = "none";
    outgoing.style.opacity = "1";
    outgoing.style.zIndex = "0";
    // Flush the invisible starting state so the browser animates the dissolve.
    void incoming.offsetWidth;

    state.fadeTarget = target;
    state.fadeStartedAt = now();
    state.fadeIncoming = incoming;
    state.fadeOutgoing = outgoing;
    state.fadeFinish = finishFade;

    if (fadeMs <= 0) {
      finishFade(true);
      return;
    }

    updateCaption(state.index);
    state.fadeMidTimer = setTimeout(updateFadeCaption, Math.round(fadeMs / 2));

    incoming.classList.add("is-fading");
    incoming.style.transition = "opacity " + fadeMs + "ms linear";
    incoming.style.opacity = "1";

    state.fadeEndHandler = function (event) {
      if (event && event.propertyName && event.propertyName !== "opacity") return;
      finishFade(false);
    };
    incoming.addEventListener("transitionend", state.fadeEndHandler, false);

    // If the TV throttles transitions, finish the dissolve rather than leave
    // the two layers stuck mid-blend.
    state.fadeTimer = setTimeout(function () {
      finishFade(false);
    }, fadeMs + 1500);
  }

  function fallbackTransition(target) {
    var outgoing = frontPlate();
    var incoming = backPlate();

    if (state.fadeTimer) {
      clearTimeout(state.fadeTimer);
      state.fadeTimer = null;
    }
    if (state.fadeMidTimer) {
      clearTimeout(state.fadeMidTimer);
      state.fadeMidTimer = null;
    }
    if (state.fadeEndHandler && incoming) {
      incoming.removeEventListener("transitionend", state.fadeEndHandler, false);
      state.fadeEndHandler = null;
    }
    incoming.classList.remove("is-fading");
    incoming.style.transition = "none";
    incoming.style.opacity = "0";
    incoming.style.zIndex = "1";
    incoming.removeAttribute("src");
    state.fadeTarget = null;
    state.fadeIncoming = null;
    state.fadeOutgoing = null;
    state.fadeFinish = null;

    var previous = state.index;
    var started = now();
    showCover();
    updateCaption(target);

    swapImage(plateSrc(CFG.plates[target]), outgoing).then(function () {
      state.lastDecodeMs = now() - started;
      return sleep(CFG.coverHoldMs);
    }).then(function () {
      hideCover();
      state.index = target;
      state.transitionCount += 1;
      state.lastFadeMs = 0;
      state.lastTransitionMs = now() - started;
      state.preloadSrc = null;
      state.preloadPromise = null;
      state.preloadStartedAt = 0;
      storeIndex(target);
      state.busy = false;
      scheduleRotation();
      drainQueue();
    }).catch(function (err) {
      console.error("Atelier cover fallback failed:", err);
      updateCaption(previous);
      swapImage(plateSrc(CFG.plates[previous]), outgoing).then(function () {
        return sleep(CFG.coverHoldMs);
      }).then(function () {
        hideCover();
        state.busy = false;
        scheduleRotation();
        drainQueue();
      }).catch(function () {
        hideCover();
        state.busy = false;
        scheduleRotation();
        drainQueue();
      });
    });
  }

  function transitionTo(target) {
    target = mod(target, CFG.plates.length);
    if (target === state.index) {
      drainQueue();
      return;
    }
    if (state.busy) {
      state.queue.push(target - state.index);
      return;
    }
    crossfadeTo(target);
  }

  function advance(delta) {
    if (state.busy) {
      state.queue.push(delta);
      // A dissolve is already showing the new plate; settle it at once so the
      // key press feels immediate, then play the queued move.
      if (state.fadeFinish) state.fadeFinish(true);
      return;
    }
    transitionTo(state.index + delta);
  }

  function drainQueue() {
    if (state.busy || !state.queue.length) return;
    var delta = state.queue.shift();
    transitionTo(state.index + delta);
  }

  function revealInitial(index) {
    var started = now();
    var image = frontPlate();
    state.index = index;
    state.busy = true;
    updateCaption(index);

    swapImage(plateSrc(CFG.plates[index]), image).then(function () {
      state.lastDecodeMs = now() - started;
      return sleep(CFG.coverHoldMs);
    }).then(function () {
      state.lastTransitionMs = now() - started;
      hideCover();
      state.busy = false;
      state.ready = true;
      document.body.classList.add("is-ready");
      storeIndex(index);
      scheduleRotation();
      drainQueue();
    }).catch(function (err) {
      console.error("Atelier could not load the opening plate:", err);
      hideCover();
      state.busy = false;
      state.ready = true;
      document.body.classList.add("is-ready");
      showToast("Could not load the artwork.");
      scheduleRotation();
      drainQueue();
    });
  }

  /* ---------- local state ---------- */

  function readStoredIndex() {
    try {
      var raw = window.localStorage.getItem("atelier.index");
      var value = parseInt(raw, 10);
      if (isFinite(value) && value >= 0 && value < CFG.plates.length) {
        return value;
      }
    } catch (err) {
      /* local storage can be unavailable in some TV containers */
    }
    return mod(CFG.startIndex || 0, CFG.plates.length);
  }

  function storeIndex(index) {
    try {
      window.localStorage.setItem("atelier.index", String(index));
    } catch (err) {
      /* non-fatal */
    }
  }

  /* ---------- clock ---------- */

  function updateClock() {
    var date = new Date();
    try {
      el.clockTime.textContent = date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
      });
      el.clockDate.textContent = date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
      });
    } catch (err) {
      el.clockTime.textContent =
        String(date.getHours()).padStart(2, "0") + ":" +
        String(date.getMinutes()).padStart(2, "0");
      el.clockDate.textContent = date.toDateString();
    }
  }

  /* ---------- focus and dock ---------- */

  /* ---------- dock usage and ranking ---------- */

  function dockItemKey(item) {
    if (!item) return "";
    if (item.action) return "action:" + item.action;
    return "app:" + (item.appId || item.label);
  }

  function isEntertainmentDockEntry(item) {
    return !!(item && item.group === "entertainment" && item.appId);
  }

  /* The current 11 bar apps set the base priority. The catalog's other
     entertainment entries are the overflow pool. Deduplicate by appId so an
     app cannot appear twice. */
  function entertainmentPool() {
    var pool = [];
    var seen = {};
    (CFG.dock || []).forEach(function (item) {
      if (!isEntertainmentDockEntry(item) || seen[item.appId]) return;
      seen[item.appId] = true;
      pool.push(item);
    });
    (CFG.catalog || []).forEach(function (item) {
      if (!item || item.entertainment !== true || !item.appId || seen[item.appId]) return;
      seen[item.appId] = true;
      pool.push(item);
    });
    return pool;
  }

  function dockEntertainmentLimit() {
    var count = 0;
    (CFG.dock || []).forEach(function (item) {
      if (isEntertainmentDockEntry(item)) count += 1;
    });
    return count || 11;
  }

  function systemDockItems() {
    return (CFG.dock || []).filter(function (item) {
      return item && item.group === "system";
    });
  }

  function emptyDockUsage() {
    return { v: DOCK_USAGE_VERSION, apps: {} };
  }

  function readDockUsage() {
    var empty = emptyDockUsage();
    var raw;
    try {
      raw = window.localStorage.getItem(DOCK_USAGE_KEY);
    } catch (err) {
      return empty;
    }
    if (!raw) return empty;
    try {
      var data = JSON.parse(raw);
      if (!data || data.v !== DOCK_USAGE_VERSION ||
          !data.apps || typeof data.apps !== "object" ||
          Object.prototype.toString.call(data.apps) !== "[object Object]") {
        return empty;
      }
      var apps = {};
      Object.keys(data.apps).slice(0, 64).forEach(function (id) {
        if (id === "__proto__" || id === "constructor" || id === "prototype") return;
        var record = data.apps[id];
        if (!record || typeof record !== "object") return;
        var count = Number(record.count);
        var last = Number(record.last);
        if (!isFinite(count) || count <= 0) return;
        count = Math.min(Math.floor(count), DOCK_USAGE_MAX_COUNT);
        if (!isFinite(last) || last < 0) last = 0;
        apps[id] = { count: count, last: Math.floor(last) };
      });
      return { v: DOCK_USAGE_VERSION, apps: apps };
    } catch (err) {
      return empty;
    }
  }

  function writeDockUsage() {
    try {
      window.localStorage.setItem(
        DOCK_USAGE_KEY,
        JSON.stringify(state.dockUsage || emptyDockUsage())
      );
    } catch (err) {
      /* Usage is a convenience; the TV can refuse storage without breaking. */
    }
  }

  function dockUsageCount(appId) {
    if (!appId || !state.dockUsage || !state.dockUsage.apps) return 0;
    var record = state.dockUsage.apps[appId];
    return record && isFinite(record.count) ? record.count : 0;
  }

  function poolEntryForAppId(appId) {
    if (!appId) return null;
    var pool = entertainmentPool();
    for (var i = 0; i < pool.length; i += 1) {
      var item = pool[i];
      if (item.appId === appId) return item;
      var fallbacks = item.fallbackAppIds || [];
      for (var j = 0; j < fallbacks.length; j += 1) {
        if (fallbacks[j] === appId) return item;
      }
    }
    return null;
  }

  function recordEntertainmentUsage(item) {
    if (!item || !item.appId) return null;
    if (!state.dockUsage) state.dockUsage = readDockUsage();
    var apps = state.dockUsage.apps;
    var previous = apps[item.appId];
    var previousCopy = previous
      ? { count: previous.count, last: previous.last }
      : null;
    var count = Math.min(
      (previous ? previous.count : 0) + 1,
      DOCK_USAGE_MAX_COUNT
    );
    apps[item.appId] = { count: count, last: Date.now() };
    writeDockUsage();
    return { appId: item.appId, previous: previousCopy };
  }

  function rollbackEntertainmentUsage(token) {
    if (!token || !state.dockUsage) return;
    if (token.previous) {
      state.dockUsage.apps[token.appId] = token.previous;
    } else {
      delete state.dockUsage.apps[token.appId];
    }
    writeDockUsage();
  }

  function recordLaunchUsage(appId) {
    var entry = poolEntryForAppId(appId);
    return entry ? recordEntertainmentUsage(entry) : null;
  }

  /* Count descending, then base priority ascending. An overflow app with the
     same count as the least-used bar app keeps the incumbent in place. */
  function computeDockOrder() {
    var ranked = entertainmentPool().map(function (item, index) {
      return { item: item, rank: index };
    });
    ranked.sort(function (a, b) {
      var countA = dockUsageCount(a.item.appId);
      var countB = dockUsageCount(b.item.appId);
      if (countA !== countB) return countB - countA;
      return a.rank - b.rank;
    });
    var limit = Math.min(dockEntertainmentLimit(), ranked.length);
    var items = ranked.slice(0, limit).map(function (entry) {
      return entry.item;
    });
    return items.concat(systemDockItems());
  }

  function sameDockOrder(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i += 1) {
      if (dockItemKey(a[i]) !== dockItemKey(b[i])) return false;
    }
    return true;
  }

  function renderDock() {
    while (el.dock.firstChild) el.dock.removeChild(el.dock.firstChild);
    dockButtons = [];
    var dividerAdded = false;

    state.dockItems.forEach(function (item, index) {
      if (!dividerAdded && index > 0 && item.group === "system") {
        var divider = document.createElement("span");
        divider.className = "dock-divider";
        divider.setAttribute("aria-hidden", "true");
        el.dock.appendChild(divider);
        dividerAdded = true;
      }

      var button = document.createElement("button");
      button.type = "button";
      button.className = "dock-item" + (item.iconStyle === "ios" ? " is-ios" : "");
      button.setAttribute("aria-label", item.label);

      var wrap = document.createElement("span");
      wrap.className = "dock-icon-wrap";

      var icon = document.createElement("img");
      icon.className = "dock-icon";
      icon.src = item.icon;
      icon.alt = "";
      icon.draggable = false;

      var label = document.createElement("span");
      label.className = "dock-label";
      label.textContent = item.label;

      wrap.appendChild(icon);
      button.appendChild(wrap);
      button.appendChild(label);

      button.addEventListener("click", function () {
        if (state.idle) {
          wakeFromIdle();
          return;
        }
        if (state.overlay) return;
        var liveIndex = dockButtons.indexOf(button);
        if (liveIndex < 0) return;
        state.dockIndex = liveIndex;
        setFocus("dock", liveIndex);
        activateDock(liveIndex);
      });
      button.addEventListener("mouseenter", function () {
        if (state.idle || state.overlay) return;
        var liveIndex = dockButtons.indexOf(button);
        if (liveIndex < 0) return;
        setFocus("dock", liveIndex);
      });

      el.dock.appendChild(button);
      dockButtons.push(button);
    });
  }

  function buildDock() {
    state.dockItems = computeDockOrder();
    renderDock();
  }

  function applyDockOrder(items) {
    var previousItems = state.dockItems || [];
    var previousIndex = state.dockIndex;
    var focusedKey = previousItems[previousIndex]
      ? dockItemKey(previousItems[previousIndex])
      : null;

    state.dockItems = items;
    renderDock();

    var newIndex = -1;
    if (focusedKey) {
      for (var i = 0; i < state.dockItems.length; i += 1) {
        if (dockItemKey(state.dockItems[i]) === focusedKey) {
          newIndex = i;
          break;
        }
      }
    }
    if (newIndex < 0) newIndex = previousIndex;
    state.dockIndex = dockButtons.length ? mod(newIndex, dockButtons.length) : 0;
    renderFocus();
  }

  function refreshDockOrder(force) {
    if (!state.ready || !state.dockItems.length || document.hidden) return false;
    if (state.launching) return false;
    if (!force && state.overlay) return false;
    var next = computeDockOrder();
    if (sameDockOrder(state.dockItems, next)) return false;
    applyDockOrder(next);
    return true;
  }

  function scheduleDockRefresh(delay) {
    if (state.dockRefreshTimer) clearTimeout(state.dockRefreshTimer);
    state.dockRefreshTimer = setTimeout(function () {
      state.dockRefreshTimer = null;
      refreshDockOrder(false);
    }, delay);
  }

  function setFocus(zone, index) {
    if (zone === "dock" && typeof index === "number") {
      state.dockIndex = mod(index, dockButtons.length);
    }
    state.focusZone = zone;
    renderFocus();
  }

  function renderFocus() {
    el.hero.classList.toggle("is-focused", state.focusZone === "art");
    el.plaque.classList.toggle(
      "is-focused",
      state.focusZone === "art" && state.mode === "framed"
    );
    dockButtons.forEach(function (button, index) {
      button.classList.toggle(
        "is-focused",
        state.focusZone === "dock" && index === state.dockIndex
      );
    });
    appButtons.forEach(function (button, index) {
      button.classList.toggle(
        "is-focused",
        state.focusZone === "apps" && index === state.appFocus
      );
    });
  }

  function moveDock(delta) {
    state.focusZone = "dock";
    state.dockIndex = mod(state.dockIndex + delta, dockButtons.length);
    renderFocus();
  }

  function activateDock(index) {
    if (state.launching) return;
    var item = state.dockItems[index];
    if (!item) return;
    markActivity();
    state.returnToApps = null;
    if (item.action === "inputs") {
      openInputs();
      return;
    }
    if (item.action === "allapps") {
      openAllApps();
      return;
    }
    if (item.action === "display") {
      openDisplay();
      return;
    }
    launchApp(item.appId, item.fallbackAppIds, item.label, item.params);
  }

  /* ---------- launching other apps ---------- */

  function launchViaManager(appId, params, uriIndex) {
    return new Promise(function (resolve, reject) {
      var uris = CFG.applicationManagerUris || [];
      if (!window.webOS || !window.webOS.service ||
          typeof window.webOS.service.request !== "function") {
        reject(new Error("webOS service bridge is unavailable"));
        return;
      }
      if (uriIndex >= uris.length) {
        reject(new Error("no application manager URI available"));
        return;
      }

      var settled = false;
      var timer = null;

      function finish(err, result) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (!err) {
          resolve(result);
          return;
        }
        if (uriIndex + 1 < uris.length) {
          launchViaManager(appId, params, uriIndex + 1).then(resolve, reject);
        } else {
          reject(err);
        }
      }

      timer = setTimeout(function () {
        finish(new Error("launch timed out"));
      }, 6000);

      var launchParams = { id: appId };
      if (params && typeof params === "object") {
        Object.keys(params).forEach(function (key) {
          launchParams[key] = params[key];
        });
      }

      try {
        window.webOS.service.request(uris[uriIndex], {
          method: "launch",
          parameters: launchParams,
          onSuccess: function (result) {
            if (result && result.returnValue === false) {
              finish(new Error(result.errorText || "launch was refused"));
            } else {
              finish(null, result);
            }
          },
          onFailure: function (err) {
            finish(new Error((err && err.errorText) || "launch failed"));
          }
        });
      } catch (err) {
        finish(err);
      }
    });
  }

  function launchApp(appId, fallbackAppIds, label, params) {
    if (!appId) {
      showToast("Could not open " + label + ".");
      return;
    }
    if (state.launching) return;

    state.launching = true;
    var ids = [appId].concat(fallbackAppIds || []);
    var usageToken = recordLaunchUsage(appId);
    if (usageToken) scheduleDockRefresh(DOCK_POST_LAUNCH_MS);

    function tryId(index) {
      if (index >= ids.length) {
        state.launching = false;
        if (usageToken) {
          rollbackEntertainmentUsage(usageToken);
          refreshDockOrder(true);
        }
        showToast("Could not open " + label + ".");
        return;
      }
      launchViaManager(ids[index], params, 0).then(function () {
        state.launching = false;
      }, function (err) {
        console.warn("Atelier could not launch", ids[index], err && err.message);
        tryId(index + 1);
      });
    }

    tryId(0);
  }

  /* ---------- overlays ---------- */

  function buildInputs() {
    CFG.inputs.forEach(function (item, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "row";
      button.setAttribute("role", "option");

      var label = document.createElement("span");
      label.className = "row-label";
      label.textContent = item.label;

      var detail = document.createElement("span");
      detail.className = "row-detail";
      detail.textContent = item.detail;

      button.appendChild(label);
      button.appendChild(detail);
      button.addEventListener("click", function () {
        state.inputFocus = index;
        renderInputsFocus();
        activateInput(index);
      });
      button.addEventListener("mouseenter", function () {
        if (state.overlay !== "inputs") return;
        state.inputFocus = index;
        renderInputsFocus();
      });

      el.inputsRows.appendChild(button);
      inputButtons.push(button);
    });
  }

  function renderInputsFocus() {
    inputButtons.forEach(function (button, index) {
      button.classList.toggle("is-focused", index === state.inputFocus);
    });
  }

  function openInputs() {
    if (state.overlay) return;
    markActivity();
    state.overlay = "inputs";
    state.inputFocus = 0;
    renderInputsFocus();
    el.inputsOverlay.classList.add("is-open");
    el.inputsOverlay.setAttribute("aria-hidden", "false");
  }

  function closeInputs() {
    el.inputsOverlay.classList.remove("is-open");
    el.inputsOverlay.setAttribute("aria-hidden", "true");
    state.overlay = null;
    if (typeof state.returnToApps === "number") {
      var returnIndex = state.returnToApps;
      state.returnToApps = null;
      openAllApps(returnIndex);
      return;
    }
    setFocus("dock", state.dockIndex);
  }

  function activateInput(index) {
    var item = CFG.inputs[index];
    if (!item) return;
    markActivity();
    state.returnToApps = null;
    closeInputs();
    launchApp(item.appId, null, item.label);
  }

  function handleInputsKey(code, event) {
    if (code === 38) {
      state.inputFocus = mod(state.inputFocus - 1, inputButtons.length);
      renderInputsFocus();
    } else if (code === 40) {
      state.inputFocus = mod(state.inputFocus + 1, inputButtons.length);
      renderInputsFocus();
    } else if (code === 13) {
      activateInput(state.inputFocus);
    } else if (code === 461 || code === 27) {
      closeInputs();
    } else {
      return;
    }
    event.preventDefault();
  }

  /* ---------- all apps ---------- */

  var APP_COLUMNS = 6;

  /* All Apps is a view, not the config order: entertainment is alphabetical
     by label, then the utilities keep their established order. */
  function catalogView() {
    var entertainment = [];
    var utilities = [];
    (CFG.catalog || []).forEach(function (item) {
      if (!item) return;
      if (item.entertainment === true) entertainment.push(item);
      else utilities.push(item);
    });
    entertainment.sort(function (a, b) {
      var labelA = String(a.label || "").toLowerCase();
      var labelB = String(b.label || "").toLowerCase();
      if (labelA < labelB) return -1;
      if (labelA > labelB) return 1;
      return 0;
    });
    return entertainment.concat(utilities);
  }

  function buildCatalog() {
    var items = catalogView();
    state.catalogItems = items;
    appButtons.forEach(function (button) {
      if (button.parentNode) button.parentNode.removeChild(button);
    });
    appButtons = [];

    items.forEach(function (item, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "app-tile" + (item.iconStyle === "ios" ? " is-ios" : "");
      button.setAttribute("aria-label", item.label);

      var icon = document.createElement("img");
      icon.className = "app-tile-icon";
      icon.src = item.icon;
      icon.alt = "";
      icon.draggable = false;

      var label = document.createElement("span");
      label.className = "app-tile-label";
      label.textContent = item.label;

      button.appendChild(icon);
      button.appendChild(label);
      button.addEventListener("click", function () {
        if (state.idle) {
          wakeFromIdle();
          return;
        }
        if (state.overlay !== "allapps") return;
        state.appFocus = index;
        renderFocus();
        activateCatalog(index);
      });
      button.addEventListener("mouseenter", function () {
        if (state.overlay !== "allapps") return;
        state.appFocus = index;
        renderFocus();
      });

      el.appsGrid.appendChild(button);
      appButtons.push(button);
    });
  }

  function openAllApps(focusIndex) {
    if (state.overlay) return;
    markActivity();
    state.returnToApps = null;
    state.overlay = "allapps";
    state.appFocus = typeof focusIndex === "number" && appButtons.length
      ? mod(focusIndex, appButtons.length)
      : 0;
    state.focusZone = "apps";
    renderFocus();
    el.allAppsOverlay.classList.add("is-open");
    el.allAppsOverlay.setAttribute("aria-hidden", "false");
    revealAppFocus();
  }

  function closeAllApps() {
    el.allAppsOverlay.classList.remove("is-open");
    el.allAppsOverlay.setAttribute("aria-hidden", "true");
    state.overlay = null;
    state.returnToApps = null;
    setFocus("dock", state.dockIndex);
  }

  function revealAppFocus() {
    var button = appButtons[state.appFocus];
    if (button && button.scrollIntoView) {
      try {
        button.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (err) {
        button.scrollIntoView(false);
      }
    }
  }

  function activateCatalog(index) {
    var item = state.catalogItems[index];
    if (!item) return;
    markActivity();
    var returnIndex = state.appFocus;
    closeAllApps();
    if (item.action === "inputs") {
      state.returnToApps = returnIndex;
      openInputs();
      return;
    }
    if (item.action === "display") {
      state.returnToApps = returnIndex;
      openDisplay();
      return;
    }
    launchApp(item.appId, item.fallbackAppIds, item.label, item.params);
  }

  function handleAllAppsKey(code, event) {
    var count = appButtons.length;
    if (!count) {
      if (code === 461 || code === 27) closeAllApps();
      event.preventDefault();
      return;
    }

    if (code === 37) {
      if (state.appFocus > 0) state.appFocus -= 1;
    } else if (code === 39) {
      if (state.appFocus + 1 < count) state.appFocus += 1;
    } else if (code === 38) {
      if (state.appFocus >= APP_COLUMNS) state.appFocus -= APP_COLUMNS;
    } else if (code === 40) {
      if (state.appFocus + APP_COLUMNS < count) state.appFocus += APP_COLUMNS;
    } else if (code === 13) {
      activateCatalog(state.appFocus);
    } else if (code === 461 || code === 27) {
      closeAllApps();
    } else {
      return;
    }
    renderFocus();
    revealAppFocus();
    event.preventDefault();
  }

  /* ---------- Atelier display ---------- */

  var RESTORE_LOG_KEY = "atelier.restoreLog";
  var RESTORE_SNAPSHOT_KEY = "atelier.restoreSnapshot";
  var RESTORE_DEFAULT_COPY = "No Atelier service, boot hook, HOME-key watcher, or foreground guard is installed. No apps were disabled by Atelier. Press OK to request stock LG Home. Back cancels.";

  function buildDisplay() {
    displayButtons = [el.displayFull, el.displayFramed, el.displayRestore];
    displayButtons.forEach(function (button, index) {
      button.addEventListener("click", function () {
        if (state.overlay !== "display" || state.restoreBusy) return;
        state.displayZone = "rows";
        state.displayFocus = index;
        renderDisplayFocus();
        if (index === 2) {
          if (state.restoreStage === "confirm") {
            if (Date.now() - state.restoreArmedAt >= 500) {
              executeRestoreStock();
            } else {
              el.restoreConfirmCopy.textContent =
                "One moment — click again after half a second. Back cancels.";
            }
          } else {
            armRestoreStock();
          }
        } else {
          resetRestoreConfirm();
          selectDisplay(index);
        }
      });
      button.addEventListener("mouseenter", function () {
        if (state.overlay !== "display" || state.restoreBusy) return;
        if (state.restoreStage === "confirm") return;
        state.displayZone = "rows";
        state.displayFocus = index;
        renderDisplayFocus();
      });
    });
    buildFrameChoices();
  }

  function buildFrameChoices() {
    if (!el.frameGrid) return;
    el.frameGrid.textContent = "";
    frameButtons = [];

    frameList().forEach(function (frame, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "frame-choice";
      button.setAttribute("role", "option");
      button.setAttribute("aria-label", frame.label + " picture frame");

      var preview = document.createElement("span");
      preview.className = "frame-preview frame-" + frame.id;

      var art = document.createElement("img");
      art.className = "frame-preview-art";
      art.alt = "";
      art.draggable = false;

      var overlay = document.createElement("span");
      overlay.className = "picture-frame is-preview frame-" + frame.id;
      overlay.setAttribute("aria-hidden", "true");
      buildFrameParts(overlay);

      preview.appendChild(art);
      preview.appendChild(overlay);

      var meta = document.createElement("span");
      meta.className = "frame-choice-meta";
      var name = document.createElement("span");
      name.className = "frame-choice-name";
      name.textContent = frame.label;
      var note = document.createElement("span");
      note.className = "frame-choice-note";
      note.textContent = frame.note || "";
      meta.appendChild(name);
      meta.appendChild(note);

      button.appendChild(preview);
      button.appendChild(meta);

      button.addEventListener("click", function () {
        if (state.overlay !== "display" || state.restoreBusy) return;
        if (state.restoreStage === "confirm") return;
        state.displayZone = "frames";
        state.frameFocus = index;
        renderDisplayFocus();
        selectFrame(index);
      });
      button.addEventListener("mouseenter", function () {
        if (state.overlay !== "display" || state.restoreBusy) return;
        if (state.restoreStage === "confirm") return;
        state.displayZone = "frames";
        state.frameFocus = index;
        renderDisplayFocus();
      });

      el.frameGrid.appendChild(button);
      frameButtons.push(button);
    });
  }

  function updateFramePreviewArt() {
    var src = frontPlate().getAttribute("src");
    if (!src) return;
    frameButtons.forEach(function (button) {
      var art = button.querySelector(".frame-preview-art");
      if (art && art.getAttribute("src") !== src) art.src = src;
    });
  }

  function revealFrameFocus() {
    var button = frameButtons[state.frameFocus];
    if (button && button.scrollIntoView) {
      try {
        button.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (err) {
        /* older containers ignore the options object */
      }
    }
  }

  function renderDisplayFocus() {
    var framesActive = state.displayZone === "frames";
    displayButtons.forEach(function (button, index) {
      var selected = (index === 1 && state.mode === "framed") ||
        (index === 0 && state.mode === "full");
      button.classList.toggle(
        "is-focused",
        !framesActive && index === state.displayFocus
      );
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    frameButtons.forEach(function (button, index) {
      button.classList.toggle(
        "is-focused",
        framesActive && index === state.frameFocus
      );
    });
  }

  function readRestoreLog() {
    try {
      var raw = window.localStorage.getItem(RESTORE_LOG_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeRestoreLog(entries) {
    try {
      window.localStorage.setItem(RESTORE_LOG_KEY, JSON.stringify(entries.slice(0, 20)));
      return true;
    } catch (err) {
      /* the visible confirmation reports that storage failed */
      return false;
    }
  }

  function appendRestoreLog(entry) {
    var entries = readRestoreLog();
    entries.unshift(entry);
    return writeRestoreLog(entries);
  }

  function updateRestoreLog(at, patch) {
    var entries = readRestoreLog();
    entries.forEach(function (entry) {
      if (entry && entry.at === at) {
        Object.keys(patch).forEach(function (key) {
          entry[key] = patch[key];
        });
      }
    });
    writeRestoreLog(entries);
  }

  function renderRestoreLog() {
    var entries = readRestoreLog();
    if (!entries.length) {
      el.restoreLog.hidden = true;
      el.restoreLog.textContent = "";
      return;
    }
    var latest = entries[0];
    el.restoreLog.hidden = false;
    el.restoreLog.textContent = "Last restore · " + (latest.shownAt || latest.at) +
      " · " + String(latest.result || "requested").replace(/-/g, " ") +
      (latest.error ? " · " + latest.error : "");
  }

  function resetRestoreConfirm() {
    state.restoreStage = null;
    state.restoreArmedAt = 0;
    state.restoreBusy = false;
    el.restoreConfirm.hidden = true;
    el.restoreConfirm.classList.remove("is-busy");
    el.restoreConfirm.setAttribute("aria-busy", "false");
    el.restoreConfirmCopy.textContent = RESTORE_DEFAULT_COPY;
    el.restoreLog.hidden = true;
    el.restoreLog.textContent = "";
  }

  function armRestoreStock() {
    if (state.restoreStage === "confirm") return;
    markActivity();
    state.restoreStage = "confirm";
    state.restoreArmedAt = Date.now();
    el.restoreConfirm.hidden = false;
    el.restoreConfirm.classList.remove("is-busy");
    el.restoreConfirm.setAttribute("aria-busy", "false");
    el.restoreConfirmCopy.textContent =
      "No Atelier service, boot hook, HOME-key watcher, or foreground guard exists on this TV. No apps were disabled, so nothing is re-enabled. A timestamped Atelier settings snapshot will be saved. Press OK again to request stock LG Home. Back cancels.";
    renderRestoreLog();
  }

  function restoreSnapshot() {
    var plate = CFG.plates[state.index];
    return {
      kind: "atelier-settings-snapshot",
      scope: "Atelier app storage only; not a TV system image",
      at: new Date().toISOString(),
      appId: "com.atelier.gallery",
      appVersion: CFG.version,
      displayMode: state.mode,
      frameStyle: state.frame,
      plateIndex: state.index,
      plateSlug: plate ? plate.slug : null,
      layers: {
        service: "none installed",
        bootHook: "none installed",
        homeWatcher: "none installed",
        foregroundGuard: "none installed"
      },
      disabledApps: [],
      uninstalledApps: [],
      developerMode: "owner-enabled; not changed by this action"
    };
  }

  function executeRestoreStock() {
    if (state.restoreBusy) return;
    state.restoreBusy = true;
    state.restoreStage = "busy";
    el.restoreConfirm.classList.add("is-busy");
    el.restoreConfirm.setAttribute("aria-busy", "true");
    el.restoreConfirmCopy.textContent =
      "Recording a timestamped Atelier settings snapshot and requesting stock LG Home…";
    el.restoreLog.hidden = false;
    el.restoreLog.textContent =
      "No Atelier service, boot hook, HOME watcher, or guard exists to stop. No apps were disabled by Atelier; nothing to re-enable.";

    var snapshot = restoreSnapshot();
    var snapshotSaved = true;
    try {
      window.localStorage.setItem(RESTORE_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (err) {
      snapshotSaved = false;
    }

    var entry = {
      at: snapshot.at,
      shownAt: new Date().toLocaleString(),
      action: "restore-stock",
      version: CFG.version,
      result: "stock-home-launch-requested",
      detail: "No Atelier service, boot hook, HOME watcher, or foreground guard installed; no apps disabled or uninstalled; stock Home launch requested."
    };
    var logSaved = appendRestoreLog(entry);

    launchViaManager("com.webos.app.home", {}, 0).then(function () {
      updateRestoreLog(entry.at, { result: "stock-home-launch-accepted" });
      el.restoreConfirmCopy.textContent =
        "Stock LG Home launch accepted. Atelier remains installed as a normal app; nothing was uninstalled, disabled, or changed in TV settings.";
      var storageNote;
      if (snapshotSaved && logSaved) {
        storageNote = "Snapshot and launch record saved to Atelier's app storage.";
      } else if (snapshotSaved) {
        storageNote = "Snapshot saved, but the launch record could not be stored.";
      } else if (logSaved) {
        storageNote = "Launch record saved, but the snapshot could not be stored.";
      } else {
        storageNote = "Atelier's app storage could not save the snapshot or launch record.";
      }
      el.restoreLog.textContent =
        storageNote + " LG Home launch accepted. Developer Mode and all apps are untouched.";
      state.restoreBusy = false;
      state.restoreStage = null;
      el.restoreConfirm.classList.remove("is-busy");
      el.restoreConfirm.setAttribute("aria-busy", "false");
    }, function (err) {
      var message = (err && err.message) ? err.message : "the launch failed";
      updateRestoreLog(entry.at, { result: "stock-home-launch-failed", error: message });
      el.restoreConfirmCopy.textContent =
        "Could not request LG Home: " + message + ". No TV settings were changed. Press OK to arm a retry, then OK once more after half a second. Back closes.";
      el.restoreLog.textContent =
        "Stock Home launch failed. Nothing was uninstalled, disabled, or changed." +
        (snapshotSaved ? " Snapshot saved." : " Snapshot could not be saved.");
      state.restoreBusy = false;
      state.restoreStage = null;
      el.restoreConfirm.classList.remove("is-busy");
      el.restoreConfirm.setAttribute("aria-busy", "false");
    });
  }

  function openDisplay() {
    if (state.overlay) return;
    markActivity();
    state.overlay = "display";
    resetRestoreConfirm();
    state.displayZone = "rows";
    state.displayFocus = state.mode === "framed" ? 1 : 0;
    state.frameFocus = currentFrameIndex();
    renderDisplayFocus();
    updateFramePreviewArt();
    el.displayOverlay.classList.add("is-open");
    el.displayOverlay.setAttribute("aria-hidden", "false");
  }

  function closeDisplay() {
    if (state.restoreBusy) return;
    resetRestoreConfirm();
    el.displayOverlay.classList.remove("is-open");
    el.displayOverlay.setAttribute("aria-hidden", "true");
    state.overlay = null;
    if (typeof state.returnToApps === "number") {
      var returnIndex = state.returnToApps;
      state.returnToApps = null;
      openAllApps(returnIndex);
      return;
    }
    setFocus("dock", state.dockIndex);
  }

  function selectDisplay(index) {
    if (index !== 0 && index !== 1) return;
    markActivity();
    setMode(index === 1 ? "framed" : "full");
    renderDisplayFocus();
  }

  function selectFrame(index) {
    var frame = frameList()[index];
    if (!frame) return;
    markActivity();
    setFrame(frame.id);
    // Choosing a finish is a preview of Framed mode itself; show it at once.
    if (state.mode !== "framed") setMode("framed");
    renderDisplayFocus();
  }

  function handleDisplayKey(code, event, okWasDown) {
    if (state.restoreBusy) {
      event.preventDefault();
      return;
    }
    if (state.restoreStage === "confirm") {
      if (code === 13) {
        if (!event.repeat && !okWasDown &&
            Date.now() - state.restoreArmedAt >= 500) {
          executeRestoreStock();
        } else {
          el.restoreConfirmCopy.textContent =
            "Release OK, then press OK again to confirm. Back cancels.";
        }
      } else if (code === 461 || code === 27) {
        resetRestoreConfirm();
        renderDisplayFocus();
      }
      event.preventDefault();
      return;
    }

    if (state.displayZone === "frames") {
      var count = frameButtons.length;
      if (!count) {
        state.displayZone = "rows";
        renderDisplayFocus();
        event.preventDefault();
        return;
      }
      if (code === 37) {
        if (state.frameFocus % FRAME_COLUMNS === 0) {
          state.displayZone = "rows";
          state.displayFocus = state.mode === "framed" ? 1 : 0;
        } else {
          state.frameFocus = mod(state.frameFocus - 1, count);
        }
      } else if (code === 39) {
        if (state.frameFocus % FRAME_COLUMNS < FRAME_COLUMNS - 1 &&
            state.frameFocus + 1 < count) {
          state.frameFocus += 1;
        }
      } else if (code === 38) {
        if (state.frameFocus >= FRAME_COLUMNS) {
          state.frameFocus -= FRAME_COLUMNS;
        }
      } else if (code === 40) {
        if (state.frameFocus + FRAME_COLUMNS < count) {
          state.frameFocus += FRAME_COLUMNS;
        }
      } else if (code === 13) {
        selectFrame(state.frameFocus);
      } else if (code === 461 || code === 27) {
        closeDisplay();
      } else {
        return;
      }
      renderDisplayFocus();
      revealFrameFocus();
      event.preventDefault();
      return;
    }

    if (code === 38) {
      state.displayFocus = mod(state.displayFocus - 1, displayButtons.length);
    } else if (code === 40) {
      state.displayFocus = mod(state.displayFocus + 1, displayButtons.length);
    } else if (code === 39) {
      state.displayZone = "frames";
      state.frameFocus = currentFrameIndex();
    } else if (code === 13) {
      if (state.displayFocus === 2) {
        armRestoreStock();
      } else {
        selectDisplay(state.displayFocus);
      }
    } else if (code === 461 || code === 27) {
      closeDisplay();
    } else {
      return;
    }
    renderDisplayFocus();
    event.preventDefault();
  }

  function openDiagnostics() {
    if (state.overlay === "inputs") closeInputs();
    if (state.overlay) return;
    markActivity();
    state.overlay = "diagnostics";
    state.keyBuffer = "";
    renderDiagnostics();
    el.diagnostics.classList.add("is-open");
    el.diagnostics.setAttribute("aria-hidden", "false");
  }

  function closeDiagnostics() {
    el.diagnostics.classList.remove("is-open");
    el.diagnostics.setAttribute("aria-hidden", "true");
    state.overlay = null;
    setFocus("dock", state.dockIndex);
  }

  function diagBaseRows() {
    var plate = CFG.plates[state.index];
    var rows = [];
    function add(key, value) {
      rows.push([key, String(value)]);
    }

    add("Rendered surface", window.innerWidth + " × " + window.innerHeight + " CSS px");
    add("Device pixel ratio", window.devicePixelRatio || 1);
    add("Screen", window.screen.width + " × " + window.screen.height + " px");
    var active = frontPlate();
    add("Current plate", (el.title.textContent || plate.title) +
        (state.busy ? " (transitioning)" : ""));
    add("Plate file", (active.getAttribute("src") || plateSrc(plate)) +
        " · " + active.naturalWidth + " × " + active.naturalHeight);
    add("Display mode", state.mode === "framed" ? "Framed" : "Full Screen");
    var frame = frameById(state.frame);
    add("Picture frame", state.mode === "framed"
      ? ((frame ? frame.label : state.frame) + " · edge-mounted")
      : ((frame ? frame.label : state.frame) + " · hidden"));
    add("Apps in All Apps", (CFG.catalog || []).length);
    add("Transitions this session", state.transitionCount);
    add("Dwell", (Number(CFG.rotateSeconds) || 60) + " s");
    add("Last decode", Math.round(state.lastDecodeMs) + " ms");
    add("Last dissolve", Math.round(state.lastFadeMs) + " ms");
    add("Last transition total", Math.round(state.lastTransitionMs) + " ms");
    add("Preload lead", (Number(CFG.preloadLeadMs) || 0) + " ms");
    add("Cover hold (fallback)", CFG.coverHoldMs + " ms");
    add("Transition policy", "two layers · decode before reveal · " +
        (Number(CFG.crossfadeMs) || 0) + " ms linear dissolve · outgoing bitmap released");
    add("LG web-app UI note", "webOS renders web-app UI at up to 1920×1080; 4K is video-only");

    try {
      if (window.webOS) {
        add("Application ID", (window.webOS.fetchAppId && window.webOS.fetchAppId()) || "n/a");
        add("webOSTV.js", window.webOS.libVersion || "unknown");
        add("Platform flags", JSON.stringify(window.webOS.platform || {}));
      }
    } catch (err) {
      add("webOS API", "unavailable");
    }
    add("User agent", navigator.userAgent);

    return rows;
  }

  function renderDiagRows(rows) {
    el.diagGrid.textContent = "";
    var fragment = document.createDocumentFragment();
    rows.forEach(function (pair) {
      var key = document.createElement("div");
      key.className = "diag-key";
      key.textContent = pair[0];
      var value = document.createElement("div");
      value.className = "diag-val";
      value.textContent = pair[1];
      fragment.appendChild(key);
      fragment.appendChild(value);
    });
    el.diagGrid.appendChild(fragment);
  }

  function renderDiagnostics() {
    var rows = diagBaseRows();
    renderDiagRows(rows);

    // Optional device facts. LG's service may refuse some keys; the library
    // falls back to what it can read, and this card simply shows less.
    try {
      if (window.webOS && typeof window.webOS.deviceInfo === "function") {
        window.webOS.deviceInfo(function (info) {
          if (!info || state.overlay !== "diagnostics") return;
          var extra = rows.slice();
          function add(key, value) {
            if (value !== undefined && value !== null && value !== "") {
              extra.push([key, String(value)]);
            }
          }
          add("Model", info.modelName);
          add("Firmware", info.version);
          add("SDK", info.sdkVersion);
          add("Panel UHD", info.uhd);
          add("Panel screen size", info.screenWidth && info.screenHeight
            ? info.screenWidth + " × " + info.screenHeight + " CSS px" : "");
          add("Memory", info.ddrSize);
          renderDiagRows(extra);
        });
      }
    } catch (err) {
      /* diagnostics are best-effort */
    }
  }

  function handleDiagnosticsKey(code, event) {
    if (code === 461 || code === 27) {
      closeDiagnostics();
    } else if (code === 38 || code === 40) {
      var panel = el.diagnostics.querySelector(".panel");
      if (panel) {
        panel.scrollTop += code === 38 ? -60 : 60;
      }
    } else {
      return;
    }
    event.preventDefault();
  }

  function showToast(message) {
    if (state.idle) return;
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      el.toast.classList.remove("is-visible");
      state.toastTimer = null;
    }, 4500);
  }

  /* ---------- idle gallery ---------- */

  function markActivity() {
    state.lastActivity = Date.now();
  }

  function enterIdle() {
    if (!state.ready || state.overlay || state.idle || state.launching) return;
    state.idle = true;
    document.body.classList.add("is-idle");
    el.toast.classList.remove("is-visible");
  }

  /* Up in the gallery toggles a hold on the painting in view. While held,
     both the rotation and its preload are cancelled; resuming arms a fresh
     full interval. Leaving the gallery clears the hold. */
  function setGalleryHold(hold) {
    hold = !!hold;
    if (state.galleryHold === hold) return;
    state.galleryHold = hold;
    document.body.classList.toggle("is-held", hold);
    if (hold) {
      if (state.rotateTimer) {
        clearTimeout(state.rotateTimer);
        state.rotateTimer = null;
      }
      if (state.preloadTimer) {
        clearTimeout(state.preloadTimer);
        state.preloadTimer = null;
      }
    } else if (!document.hidden) {
      scheduleRotation();
    }
  }

  function wakeFromIdle() {
    if (!state.idle) return;
    state.idle = false;
    setGalleryHold(false);
    document.body.classList.remove("is-idle");
    markActivity();
    /* Usage may have changed while the TV was in another app. Apply a new
       order as the home screen reappears, preserving the dock focus. */
    refreshDockOrder(true);
  }

  function dismissOverlaysForIdle() {
    if (state.restoreBusy) return false;
    el.inputsOverlay.classList.remove("is-open");
    el.inputsOverlay.setAttribute("aria-hidden", "true");
    el.allAppsOverlay.classList.remove("is-open");
    el.allAppsOverlay.setAttribute("aria-hidden", "true");
    el.displayOverlay.classList.remove("is-open");
    el.displayOverlay.setAttribute("aria-hidden", "true");
    el.diagnostics.classList.remove("is-open");
    el.diagnostics.setAttribute("aria-hidden", "true");
    resetRestoreConfirm();
    state.overlay = null;
    state.returnToApps = null;
    state.keyBuffer = "";
    /* Do not strand focus on a tile inside the now-hidden All Apps panel. */
    setFocus("dock", state.dockIndex);
    return true;
  }

  function checkIdle() {
    if (!state.ready || state.launching || state.idle) return;
    if (Date.now() - state.lastActivity < CFG.idleAfterSeconds * 1000) return;
    if (state.overlay && !dismissOverlaysForIdle()) return;
    enterIdle();
  }

  function scheduleRotation() {
    if (state.rotateTimer) {
      clearTimeout(state.rotateTimer);
      state.rotateTimer = null;
    }
    if (state.preloadTimer) {
      clearTimeout(state.preloadTimer);
      state.preloadTimer = null;
    }

    var rotateMs = Math.max(5000, (Number(CFG.rotateSeconds) || 60) * 1000);
    var preloadLeadMs = Math.min(
      Math.max(0, Number(CFG.preloadLeadMs) || 0),
      rotateMs - 1000
    );

    if (preloadLeadMs > 0) {
      state.preloadTimer = setTimeout(function () {
        state.preloadTimer = null;
        preloadNextPlate();
      }, rotateMs - preloadLeadMs);
    }

    state.rotateTimer = setTimeout(function () {
      state.rotateTimer = null;
      if (document.hidden || state.overlay) {
        scheduleRotation();
        return;
      }
      if (!state.busy) {
        advance(1);
      }
      scheduleRotation();
    }, rotateMs);
  }

  function startTimers() {
    if (!state.idleTimer) {
      state.idleTimer = setInterval(checkIdle, 1000);
    }
    if (!state.clockTimer) {
      state.clockTimer = setInterval(updateClock, 15000);
    }
    if (!state.dockTimer) {
      state.dockTimer = setInterval(function () {
        refreshDockOrder(false);
      }, DOCK_REFRESH_MS);
    }
    /* Returning to a gallery that was left held must not restart rotation. */
    if (state.idle && state.galleryHold) {
      if (state.rotateTimer) {
        clearTimeout(state.rotateTimer);
        state.rotateTimer = null;
      }
      if (state.preloadTimer) {
        clearTimeout(state.preloadTimer);
        state.preloadTimer = null;
      }
    } else {
      scheduleRotation();
    }
  }

  function stopTimers() {
    if (state.idleTimer) {
      clearInterval(state.idleTimer);
      state.idleTimer = null;
    }
    if (state.clockTimer) {
      clearInterval(state.clockTimer);
      state.clockTimer = null;
    }
    if (state.dockTimer) {
      clearInterval(state.dockTimer);
      state.dockTimer = null;
    }
    if (state.dockRefreshTimer) {
      clearTimeout(state.dockRefreshTimer);
      state.dockRefreshTimer = null;
    }
    if (state.rotateTimer) {
      clearTimeout(state.rotateTimer);
      state.rotateTimer = null;
    }
    if (state.preloadTimer) {
      clearTimeout(state.preloadTimer);
      state.preloadTimer = null;
    }
  }

  /* ---------- input ---------- */

  function handleBack() {
    if (state.overlay === "inputs") {
      closeInputs();
      return;
    }
    if (state.overlay === "allapps") {
      closeAllApps();
      return;
    }
    if (state.overlay === "display") {
      closeDisplay();
      return;
    }
    if (state.overlay === "diagnostics") {
      closeDiagnostics();
      return;
    }
    if (state.focusZone === "art") {
      setFocus("dock", state.dockIndex);
      return;
    }
    try {
      if (window.webOS && typeof window.webOS.platformBack === "function") {
        window.webOS.platformBack();
      }
    } catch (err) {
      /* the platform will handle an uncaught back press */
    }
  }

  function onKeyUp(event) {
    var code = event.keyCode || event.which;
    if (code === 13) state.okDown = false;
    if (code === 38) state.upHeld = false;
  }

  function onKeyDown(event) {
    var code = event.keyCode || event.which;
    if (event.key === "GoBack" || event.key === "BrowserBack") code = 461;
    var okWasDown = state.okDown;
    if (code === 13) state.okDown = true;
    /* A held Up must not toggle the gallery hold repeatedly. The flag is
       cleared on keyup; repeated keydowns from one press are ignored. The
       timestamp recovers if a keyup is ever missed. */
    var upRepeat = false;
    if (code === 38) {
      var now = Date.now();
      upRepeat = state.upHeld && now - state.upHeldAt < 1000;
      state.upHeld = true;
      state.upHeldAt = now;
    }

    // Idle is a picture. Left and Right move through the gallery; Down
    // returns to the home screen with the dock focused; Up holds the
    // painting in view, and a second Up resumes the rotation. Any other
    // key wakes the picture, and that key is consumed.
    if (state.idle) {
      if (code === 37) {
        advance(-1);
      } else if (code === 39) {
        advance(1);
      } else if (code === 40) {
        wakeFromIdle();
        setFocus("dock", state.dockIndex);
      } else if (code === 38) {
        if (!upRepeat) setGalleryHold(!state.galleryHold);
      } else {
        wakeFromIdle();
      }
      event.preventDefault();
      return;
    }

    markActivity();

    if (state.overlay === "inputs") {
      handleInputsKey(code, event);
      return;
    }
    if (state.overlay === "allapps") {
      handleAllAppsKey(code, event);
      return;
    }
    if (state.overlay === "display") {
      handleDisplayKey(code, event, okWasDown);
      return;
    }
    if (state.overlay === "diagnostics") {
      handleDiagnosticsKey(code, event);
      return;
    }

    // The verification card opens with 1-9-1-1. Digits are swallowed so they
    // never act as channel input inside Atelier.
    if (code >= 48 && code <= 57) {
      state.keyBuffer = (state.keyBuffer + String.fromCharCode(code)).slice(-4);
      if (state.keyBuffer === CFG.diagnosticsSequence) {
        state.keyBuffer = "";
        openDiagnostics();
      }
      event.preventDefault();
      return;
    }
    state.keyBuffer = "";

    if (code === 37) {
      if (state.focusZone === "dock") {
        moveDock(-1);
      } else {
        setFocus("art");
        advance(-1);
      }
      event.preventDefault();
    } else if (code === 39) {
      if (state.focusZone === "dock") {
        moveDock(1);
      } else {
        setFocus("art");
        advance(1);
      }
      event.preventDefault();
    } else if (code === 38) {
      // Up starts the gallery from anywhere on the home screen. Enter on the
      // artwork remains a second way in.
      enterIdle();
      event.preventDefault();
    } else if (code === 40) {
      if (state.focusZone === "art") setFocus("dock", state.dockIndex);
      event.preventDefault();
    } else if (code === 13) {
      if (state.focusZone === "dock") {
        activateDock(state.dockIndex);
      } else {
        enterIdle();
      }
      event.preventDefault();
    } else if (code === 461 || code === 27) {
      handleBack();
      event.preventDefault();
    }
  }

  function onPointerActivity() {
    if (state.idle) wakeFromIdle();
    markActivity();
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown, false);
    document.addEventListener("keyup", onKeyUp, false);
    window.addEventListener("mousemove", onPointerActivity, false);

    el.stage.addEventListener("click", function (event) {
      if (event.target !== el.stage) return;
      if (state.idle) {
        wakeFromIdle();
        return;
      }
      if (state.overlay) return;
      markActivity();
      setFocus("art");
      advance(1);
    });

    el.inputsOverlay.addEventListener("click", function (event) {
      if (event.target === el.inputsOverlay) closeInputs();
    });
    el.allAppsOverlay.addEventListener("click", function (event) {
      if (event.target === el.allAppsOverlay) closeAllApps();
    });
    el.displayOverlay.addEventListener("click", function (event) {
      if (event.target === el.displayOverlay) closeDisplay();
    });
    el.diagnostics.addEventListener("click", function (event) {
      if (event.target === el.diagnostics) closeDiagnostics();
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        // A throttled or paused dissolve should settle at full opacity before
        // the app is backgrounded, not resume mid-blend later.
        state.queue.length = 0;
        if (state.fadeFinish) state.fadeFinish(true);
        stopTimers();
      } else {
        markActivity();
        state.launching = false;
        updateClock();
        refreshDockOrder(true);
        if (state.ready) startTimers();
      }
    });

    window.addEventListener("error", function (event) {
      console.error("Atelier error:", event.message || event);
    });
  }

  /* ---------- boot ---------- */

  function init() {
    cacheDom();
    resetLayers();
    buildFrameParts(el.pictureFrame);
    state.dockUsage = readDockUsage();
    buildDock();
    buildInputs();
    buildCatalog();
    buildDisplay();
    updateClock();
    bindEvents();

    state.index = readStoredIndex();
    state.frame = readStoredFrame();
    updateCaption(state.index);
    applyFrameStyle(state.frame);
    // Rewrite a stale finish id from an older build with the finish now shown.
    storeFrame(state.frame);
    applyMode(readStoredMode());
    setFocus("dock", 0);

    try {
      if (document.fonts && document.fonts.load) {
        document.fonts.load('400 56px "EB Garamond"');
        document.fonts.load('italic 400 19px "EB Garamond"');
      }
    } catch (err) {
      /* fallback fonts remain available */
    }

    startTimers();
    revealInitial(state.index);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
