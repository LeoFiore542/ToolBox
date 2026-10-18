(function () {
  const form = document.getElementById("countdown-form");
  const hoursInput = document.getElementById("countdown-hours");
  const minutesInput = document.getElementById("countdown-minutes");
  const hintEl = document.getElementById("countdown-hint");
  const errorEl = document.getElementById("countdown-error");
  const stageEl = document.getElementById("countdown-stage");
  const targetEl = document.getElementById("countdown-target");
  const resetBtn = document.getElementById("countdown-reset");
  const closeBtn = document.getElementById("countdown-close");
  const displayEl = document.getElementById("countdown-display");
  const doneEl = document.getElementById("countdown-done");
  const hoursEl = document.getElementById("cd-hours");
  const minutesEl = document.getElementById("cd-minutes");
  const secondsEl = document.getElementById("cd-seconds");
  const progressBar = document.getElementById("countdown-progress-bar");
  const progressRoot = document.querySelector(".countdown-progress");
  const presetButtons = document.querySelectorAll(".countdown-preset");

  if (!form || !hoursInput || !minutesInput || !stageEl) return;

  let targetDate = null;
  let startedAt = null;
  let totalMs = 0;
  let tickId = null;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function showError(message) {
    errorEl.hidden = !message;
    errorEl.textContent = message || "";
  }

  function getSelectedTime() {
    const hoursRaw = hoursInput.value.trim();
    const minutesRaw = minutesInput.value.trim();

    if (hoursRaw === "" || minutesRaw === "") {
      return null;
    }

    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return { hours, minutes };
  }

  function resolveTarget(hours, minutes) {
    const now = new Date();
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0
    );

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return target;
  }

  function formatClock(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatTarget(date) {
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const time = formatClock(date);
    const today = new Date();
    const isTomorrow =
      date.getDate() !== today.getDate() ||
      date.getMonth() !== today.getMonth() ||
      date.getFullYear() !== today.getFullYear();

    return isTomorrow
      ? `Domani ${day}/${month}/${year} · ${time}`
      : `Oggi · ${time}`;
  }

  function updateHint() {
    const selected = getSelectedTime();
    if (!selected) {
      hintEl.textContent = "Inserisci ore (0–23) e minuti (0–59).";
      return;
    }

    const target = resolveTarget(selected.hours, selected.minutes);
    const today = new Date();
    const isTomorrow =
      target.getDate() !== today.getDate() ||
      target.getMonth() !== today.getMonth() ||
      target.getFullYear() !== today.getFullYear();

    hintEl.textContent = isTomorrow
      ? `Conto alla rovescia fino a domani alle ${formatClock(target)}`
      : `Conto alla rovescia fino a oggi alle ${formatClock(target)}`;
  }

  function setTimeValues(hours, minutes) {
    hoursInput.value = pad(hours);
    minutesInput.value = pad(minutes);
    updateHint();
  }

  function normalizeField(input, max) {
    if (input.value.trim() === "") return;
    let value = Number(input.value);
    if (Number.isNaN(value)) {
      input.value = "";
      return;
    }
    value = Math.max(0, Math.min(max, Math.trunc(value)));
    input.value = pad(value);
  }

  function setDefaultTime() {
    const now = new Date();
    now.setSeconds(0, 0);
    now.setMinutes(now.getMinutes() + 15);
    setTimeValues(now.getHours(), now.getMinutes());
  }

  function applyPreset(offsetMinutes) {
    const now = new Date();
    now.setSeconds(0, 0);
    now.setMinutes(now.getMinutes() + offsetMinutes);
    setTimeValues(now.getHours(), now.getMinutes());
    showError("");
  }

  function clearAlertState() {
    stageEl.classList.remove("is-warning", "is-danger");
  }

  function updateAlertState(remainingMs) {
    const thirtyMin = 30 * 60 * 1000;
    const tenMin = 10 * 60 * 1000;

    stageEl.classList.toggle("is-danger", remainingMs > 0 && remainingMs <= tenMin);
    stageEl.classList.toggle(
      "is-warning",
      remainingMs > tenMin && remainingMs <= thirtyMin
    );
  }

  function setStageOpen(open) {
    stageEl.hidden = !open;
    document.body.classList.toggle("countdown-active", open);
    if (!open) clearAlertState();
  }

  function setFinishedUi(finished) {
    displayEl.hidden = finished;
    doneEl.hidden = !finished;
  }

  function stopTicker() {
    if (tickId !== null) {
      clearInterval(tickId);
      tickId = null;
    }
  }

  function renderProgress(remainingMs) {
    if (!totalMs) {
      progressBar.style.width = "100%";
      if (progressRoot) progressRoot.setAttribute("aria-valuenow", "100");
      return;
    }

    const ratio = Math.min(1, Math.max(0, remainingMs / totalMs));
    const percent = Math.round(ratio * 100);
    progressBar.style.width = `${ratio * 100}%`;
    if (progressRoot) progressRoot.setAttribute("aria-valuenow", String(percent));
  }

  function renderRemaining(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);
  }

  function tick() {
    if (!targetDate || !startedAt) return;

    const now = Date.now();
    const remaining = targetDate.getTime() - now;

    if (remaining <= 0) {
      renderRemaining(0);
      renderProgress(0);
      clearAlertState();
      stageEl.classList.add("is-danger");
      stopTicker();
      setFinishedUi(true);
      return;
    }

    setFinishedUi(false);
    renderRemaining(remaining);
    renderProgress(remaining);
    updateAlertState(remaining);
  }

  function startCountdown(event) {
    event.preventDefault();
    showError("");
    normalizeField(hoursInput, 23);
    normalizeField(minutesInput, 59);

    const selected = getSelectedTime();
    if (!selected) {
      showError("Inserisci un orario valido (ore 0–23, minuti 0–59).");
      return;
    }

    targetDate = resolveTarget(selected.hours, selected.minutes);
    startedAt = new Date();
    totalMs = Math.max(1, targetDate.getTime() - startedAt.getTime());
    targetEl.textContent = formatTarget(targetDate);
    setFinishedUi(false);
    setStageOpen(true);
    stopTicker();
    tick();
    tickId = setInterval(tick, 100);
  }

  function closeCountdown() {
    stopTicker();
    targetDate = null;
    startedAt = null;
    totalMs = 0;
    showError("");
    hoursEl.textContent = "00";
    minutesEl.textContent = "00";
    secondsEl.textContent = "00";
    renderProgress(0);
    setFinishedUi(false);
    clearAlertState();
    setStageOpen(false);
  }

  setDefaultTime();

  hoursInput.addEventListener("input", updateHint);
  minutesInput.addEventListener("input", updateHint);
  hoursInput.addEventListener("blur", () => {
    normalizeField(hoursInput, 23);
    updateHint();
  });
  minutesInput.addEventListener("blur", () => {
    normalizeField(minutesInput, 59);
    updateHint();
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyPreset(Number(button.dataset.offset));
    });
  });

  form.addEventListener("submit", startCountdown);
  resetBtn.addEventListener("click", closeCountdown);
  closeBtn.addEventListener("click", closeCountdown);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !stageEl.hidden) {
      closeCountdown();
    }
  });
})();
