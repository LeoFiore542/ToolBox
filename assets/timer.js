(function () {
  const form = document.getElementById("timer-settings");
  const workInput = document.getElementById("timer-work");
  const shortInput = document.getElementById("timer-short");
  const longInput = document.getElementById("timer-long");
  const fontSelect = document.getElementById("timer-font");
  const errorEl = document.getElementById("timer-error");
  const stageEl = document.getElementById("timer-stage");
  const closeBtn = document.getElementById("timer-close");
  const displayEl = document.getElementById("timer-stage-display");
  const minutesEl = document.getElementById("timer-minutes");
  const secondsEl = document.getElementById("timer-seconds");
  const choiceEl = document.getElementById("timer-choice");
  const choiceLabel = document.getElementById("timer-choice-label");
  const choiceBreak = document.getElementById("timer-choice-break");
  const choiceWork = document.getElementById("timer-choice-work");
  const pickShortBtn = document.getElementById("timer-pick-short");
  const pickLongBtn = document.getElementById("timer-pick-long");
  const pickWorkBtn = document.getElementById("timer-pick-work");

  if (!form || !workInput || !stageEl) return;

  const DEFAULTS = { work: 25, short: 5, long: 15 };
  const FONT_VALUES = new Set(["serif", "sans", "rounded", "mono", "outfit"]);
  const MODE_LABELS = {
    work: "Lavoro",
    short: "Pausa breve",
    long: "Pausa lunga",
  };

  let mode = "work";
  let remainingMs = 0;
  let totalMs = 0;
  let running = false;
  let endsAt = null;
  let tickId = null;
  let durations = { ...DEFAULTS };
  let closeArmedAt = 0;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function showError(message) {
    errorEl.hidden = !message;
    errorEl.textContent = message || "";
  }

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(n)));
  }

  function normalizeInputs() {
    workInput.value = String(clampInt(workInput.value, 1, 180, DEFAULTS.work));
    shortInput.value = String(clampInt(shortInput.value, 1, 60, DEFAULTS.short));
    longInput.value = String(clampInt(longInput.value, 1, 90, DEFAULTS.long));
  }

  function readDurations() {
    normalizeInputs();

    const work = clampInt(workInput.value, 1, 180, DEFAULTS.work);
    const short = clampInt(shortInput.value, 1, 60, DEFAULTS.short);
    const long = clampInt(longInput.value, 1, 90, DEFAULTS.long);

    if (work < 1 || short < 1 || long < 1) {
      return null;
    }

    return { work, short, long };
  }

  function selectedFont() {
    const value = fontSelect?.value || "serif";
    return FONT_VALUES.has(value) ? value : "serif";
  }

  function applyFont() {
    stageEl.dataset.font = selectedFont();
  }

  function stopTicker() {
    if (tickId !== null) {
      clearInterval(tickId);
      tickId = null;
    }
  }

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      [659, 880, 1174].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02 + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42 + index * 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.1);
        osc.stop(now + 0.5 + index * 0.1);
      });
      setTimeout(() => ctx.close(), 1000);
    } catch (_) {
      /* audio optional */
    }
  }

  function renderTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);

    if (running) {
      document.title = `${pad(minutes)}:${pad(seconds)} · ${MODE_LABELS[mode]} — ToolBox`;
    } else if (!stageEl.hidden) {
      document.title = `00:00 · Timer — ToolBox`;
    } else {
      document.title = "Timer — ToolBox";
    }
  }

  function setStageOpen(open) {
    stageEl.hidden = !open;
    document.body.classList.toggle("timer-active", open);
    if (!open) {
      stageEl.classList.remove("is-finished", "is-work", "is-short", "is-long");
      displayEl.classList.remove("is-done");
      choiceEl.hidden = true;
      choiceBreak.hidden = true;
      choiceWork.hidden = true;
    }
  }

  function setRunningView() {
    running = true;
    stageEl.classList.remove("is-finished");
    stageEl.classList.toggle("is-work", mode === "work");
    stageEl.classList.toggle("is-short", mode === "short");
    stageEl.classList.toggle("is-long", mode === "long");
    displayEl.classList.remove("is-done");
    choiceEl.hidden = true;
    choiceBreak.hidden = true;
    choiceWork.hidden = true;
  }

  function replayFinishAnimation() {
    stageEl.classList.remove("is-finished");
    displayEl.classList.remove("is-done");
    void stageEl.offsetWidth;
    stageEl.classList.add("is-finished");
    displayEl.classList.add("is-done");
  }

  function showFinishedChoice() {
    running = false;
    replayFinishAnimation();
    choiceEl.hidden = false;

    if (mode === "work") {
      choiceLabel.textContent = "Pausa";
      choiceLabel.hidden = false;
      choiceBreak.hidden = false;
      choiceWork.hidden = true;
    } else {
      choiceLabel.hidden = true;
      choiceBreak.hidden = true;
      choiceWork.hidden = false;
    }
  }

  function finishSession() {
    stopTicker();
    endsAt = null;
    remainingMs = 0;
    renderTime(0);
    playChime();
    showFinishedChoice();
  }

  function tick() {
    if (!endsAt) return;
    remainingMs = Math.max(0, endsAt - Date.now());
    renderTime(remainingMs);
    if (remainingMs <= 0) finishSession();
  }

  function startMode(nextMode) {
    mode = nextMode;
    totalMs = durations[mode] * 60 * 1000;
    remainingMs = totalMs;
    endsAt = Date.now() + remainingMs;
    applyFont();
    closeArmedAt = Date.now() + 400;
    setStageOpen(true);
    setRunningView();
    renderTime(remainingMs);
    stopTicker();
    tick();
    tickId = setInterval(tick, 100);
  }

  function closeStage() {
    if (Date.now() < closeArmedAt) return;
    stopTicker();
    endsAt = null;
    running = false;
    remainingMs = 0;
    totalMs = 0;
    mode = "work";
    closeArmedAt = 0;
    setStageOpen(false);
    document.title = "Timer — ToolBox";
  }

  function startFromSetup(event) {
    event.preventDefault();
    event.stopPropagation();

    const selected = readDurations();
    if (!selected) {
      showError("Inserisci durate valide in minuti (numeri interi ≥ 1).");
      return;
    }

    showError("");
    durations = selected;
    startMode("work");
  }

  form.addEventListener("submit", startFromSetup);
  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeStage();
  });
  pickShortBtn.addEventListener("click", () => startMode("short"));
  pickLongBtn.addEventListener("click", () => startMode("long"));
  pickWorkBtn.addEventListener("click", () => startMode("work"));
  fontSelect?.addEventListener("change", applyFont);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !stageEl.hidden) {
      closeStage();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && running && endsAt) tick();
  });

  normalizeInputs();
  applyFont();
})();
