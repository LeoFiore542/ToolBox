(function () {
  const workInput = document.getElementById("timer-work");
  const shortInput = document.getElementById("timer-short");
  const longInput = document.getElementById("timer-long");
  const errorEl = document.getElementById("timer-error");
  const statusEl = document.getElementById("timer-status");
  const minutesEl = document.getElementById("timer-minutes");
  const secondsEl = document.getElementById("timer-seconds");
  const progressRoot = document.getElementById("timer-progress");
  const progressBar = document.getElementById("timer-progress-bar");
  const sessionCountEl = document.getElementById("timer-session-count");
  const toggleBtn = document.getElementById("timer-toggle");
  const skipBtn = document.getElementById("timer-skip");
  const resetBtn = document.getElementById("timer-reset");
  const modeButtons = document.querySelectorAll(".timer-mode");
  const panel = document.querySelector(".timer-panel");

  if (!workInput || !toggleBtn || !panel) return;

  const MODE_LABELS = {
    work: "Lavoro",
    short: "Pausa breve",
    long: "Pausa lunga",
  };

  const DEFAULTS = { work: 25, short: 5, long: 15 };
  const LONG_BREAK_EVERY = 4;

  let mode = "work";
  let remainingMs = DEFAULTS.work * 60 * 1000;
  let totalMs = remainingMs;
  let running = false;
  let endsAt = null;
  let tickId = null;
  let completedSessions = 0;

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

  function readDurations() {
    const work = clampInt(workInput.value, 1, 180, DEFAULTS.work);
    const short = clampInt(shortInput.value, 1, 60, DEFAULTS.short);
    const long = clampInt(longInput.value, 1, 90, DEFAULTS.long);

    if (
      !Number.isInteger(Number(workInput.value)) ||
      !Number.isInteger(Number(shortInput.value)) ||
      !Number.isInteger(Number(longInput.value)) ||
      Number(workInput.value) < 1 ||
      Number(shortInput.value) < 1 ||
      Number(longInput.value) < 1
    ) {
      return null;
    }

    return { work, short, long };
  }

  function normalizeInputs() {
    workInput.value = String(clampInt(workInput.value, 1, 180, DEFAULTS.work));
    shortInput.value = String(clampInt(shortInput.value, 1, 60, DEFAULTS.short));
    longInput.value = String(clampInt(longInput.value, 1, 90, DEFAULTS.long));
  }

  function durationFor(selectedMode, durations) {
    return durations[selectedMode] * 60 * 1000;
  }

  function renderTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);
    document.title =
      running || remainingMs < totalMs
        ? `${pad(minutes)}:${pad(seconds)} · Timer — ToolBox`
        : "Timer — ToolBox";
  }

  function renderProgress(ms) {
    if (!totalMs) {
      progressBar.style.width = "100%";
      progressRoot.setAttribute("aria-valuenow", "100");
      return;
    }
    const ratio = Math.min(1, Math.max(0, ms / totalMs));
    const percent = Math.round(ratio * 100);
    progressBar.style.width = `${ratio * 100}%`;
    progressRoot.setAttribute("aria-valuenow", String(percent));
  }

  function setModeUi(selectedMode) {
    modeButtons.forEach((button) => {
      const active = button.dataset.mode === selectedMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    panel.dataset.mode = selectedMode;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setRunningUi(isRunning) {
    running = isRunning;
    toggleBtn.textContent = isRunning ? "Pausa" : "Avvia";
    panel.classList.toggle("is-running", isRunning);
    [workInput, shortInput, longInput].forEach((input) => {
      input.disabled = isRunning;
    });
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
      [880, 1174].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02 + index * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + index * 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.12);
        osc.stop(now + 0.4 + index * 0.12);
      });
      setTimeout(() => ctx.close(), 800);
    } catch (_) {
      /* audio optional */
    }
  }

  function applyMode(selectedMode, { keepRunning = false } = {}) {
    const durations = readDurations();
    if (!durations) {
      showError("Inserisci durate valide in minuti (numeri interi ≥ 1).");
      normalizeInputs();
      return false;
    }

    showError("");
    mode = selectedMode;
    totalMs = durationFor(mode, durations);
    remainingMs = totalMs;
    endsAt = keepRunning ? Date.now() + remainingMs : null;
    setModeUi(mode);
    setStatus(keepRunning ? `${MODE_LABELS[mode]} in corso` : `Pronto · ${MODE_LABELS[mode]}`);
    renderTime(remainingMs);
    renderProgress(remainingMs);
    return true;
  }

  function nextModeAfterFinish() {
    if (mode === "work") {
      completedSessions += 1;
      sessionCountEl.textContent = String(completedSessions);
      return completedSessions % LONG_BREAK_EVERY === 0 ? "long" : "short";
    }
    return "work";
  }

  function finishSession() {
    stopTicker();
    remainingMs = 0;
    renderTime(0);
    renderProgress(0);
    playChime();
    const next = nextModeAfterFinish();
    setStatus(`${MODE_LABELS[mode]} terminata`);
    setRunningUi(false);
    applyMode(next);
  }

  function tick() {
    if (!endsAt) return;
    remainingMs = Math.max(0, endsAt - Date.now());
    renderTime(remainingMs);
    renderProgress(remainingMs);
    if (remainingMs <= 0) finishSession();
  }

  function start() {
    const durations = readDurations();
    if (!durations) {
      showError("Inserisci durate valide in minuti (numeri interi ≥ 1).");
      normalizeInputs();
      return;
    }

    showError("");
    if (remainingMs <= 0 || remainingMs > durationFor(mode, durations)) {
      totalMs = durationFor(mode, durations);
      remainingMs = totalMs;
    }

    endsAt = Date.now() + remainingMs;
    setRunningUi(true);
    setStatus(`${MODE_LABELS[mode]} in corso`);
    stopTicker();
    tick();
    tickId = setInterval(tick, 100);
  }

  function pause() {
    if (endsAt) remainingMs = Math.max(0, endsAt - Date.now());
    endsAt = null;
    stopTicker();
    setRunningUi(false);
    setStatus(`In pausa · ${MODE_LABELS[mode]}`);
    renderTime(remainingMs);
    renderProgress(remainingMs);
  }

  function toggle() {
    if (running) pause();
    else start();
  }

  function skip() {
    const wasRunning = running;
    stopTicker();
    endsAt = null;
    setRunningUi(false);

    if (mode === "work") {
      completedSessions += 1;
      sessionCountEl.textContent = String(completedSessions);
      applyMode(completedSessions % LONG_BREAK_EVERY === 0 ? "long" : "short", {
        keepRunning: wasRunning,
      });
    } else {
      applyMode("work", { keepRunning: wasRunning });
    }

    if (wasRunning) start();
  }

  function reset() {
    stopTicker();
    endsAt = null;
    setRunningUi(false);
    completedSessions = 0;
    sessionCountEl.textContent = "0";
    normalizeInputs();
    applyMode(mode);
    setStatus(`Pronto · ${MODE_LABELS[mode]}`);
  }

  function onDurationChange() {
    if (running) return;
    const durations = readDurations();
    if (!durations) return;
    showError("");
    totalMs = durationFor(mode, durations);
    remainingMs = totalMs;
    renderTime(remainingMs);
    renderProgress(remainingMs);
    setStatus(`Pronto · ${MODE_LABELS[mode]}`);
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mode === mode && !running) {
        applyMode(mode);
        return;
      }
      const wasRunning = running;
      stopTicker();
      endsAt = null;
      setRunningUi(false);
      applyMode(button.dataset.mode);
      if (wasRunning) start();
    });
  });

  [workInput, shortInput, longInput].forEach((input) => {
    input.addEventListener("change", () => {
      normalizeInputs();
      onDurationChange();
    });
    input.addEventListener("input", onDurationChange);
  });

  toggleBtn.addEventListener("click", toggle);
  skipBtn.addEventListener("click", skip);
  resetBtn.addEventListener("click", reset);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && running && endsAt) tick();
  });

  normalizeInputs();
  applyMode("work");
})();
