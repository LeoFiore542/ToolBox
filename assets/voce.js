const dropzone = document.getElementById("voce-dropzone");
const fileInput = document.getElementById("voce-file");
const intensitySelect = document.getElementById("voce-intensity");
const effectsFieldset = document.getElementById("voce-effects");
const metaEl = document.getElementById("voce-meta");
const errorEl = document.getElementById("voce-error");
const emptyEl = document.getElementById("voce-empty");
const panelEl = document.getElementById("voce-panel");
const origNameEl = document.getElementById("voce-orig-name");
const procStatusEl = document.getElementById("voce-proc-status");
const enhanceBtn = document.getElementById("voce-enhance");
const clearBtn = document.getElementById("voce-clear");
const playOrigBtn = document.getElementById("voce-play-orig");
const playProcBtn = document.getElementById("voce-play-proc");
const downloadBtn = document.getElementById("voce-download");
const stopBtn = document.getElementById("voce-stop");
const waveOrigCanvas = document.getElementById("voce-wave-orig");
const waveProcCanvas = document.getElementById("voce-wave-proc");

if (!dropzone || !fileInput || !waveOrigCanvas || !waveProcCanvas) {
  throw new Error("Tool Voce limpida non trovato.");
}

/** @type {AudioBuffer | null} */
let originalBuffer = null;
/** @type {AudioBuffer | null} */
let processedBuffer = null;
/** @type {string} */
let fileName = "";
/** @type {AudioContext | null} */
let playCtx = null;
/** @type {AudioBufferSourceNode | null} */
let activeSource = null;
/** @type {number | null} */
let playStartCtxTime = null;
/** @type {number} */
let playOffset = 0;
/** @type {"orig" | "proc" | null} */
let playingKind = null;
/** @type {number | null} */
let rafId = null;

const PRESETS = {
  light: {
    highPass: 70,
    lowPass: 10000,
    presenceGain: 2.5,
    presenceFreq: 3000,
    compressor: { threshold: -24, knee: 18, ratio: 2.5, attack: 0.01, release: 0.2 },
    gateThreshold: 0.012,
    gateFloor: 0.18,
    targetPeak: 0.9,
  },
  medium: {
    highPass: 85,
    lowPass: 9000,
    presenceGain: 4,
    presenceFreq: 2800,
    compressor: { threshold: -28, knee: 14, ratio: 4, attack: 0.008, release: 0.18 },
    gateThreshold: 0.018,
    gateFloor: 0.08,
    targetPeak: 0.93,
  },
  strong: {
    highPass: 100,
    lowPass: 8000,
    presenceGain: 5.5,
    presenceFreq: 2600,
    compressor: { threshold: -32, knee: 10, ratio: 6, attack: 0.005, release: 0.15 },
    gateThreshold: 0.025,
    gateFloor: 0.04,
    targetPeak: 0.95,
  },
};

const EFFECT_LABELS = {
  highpass: "High-pass",
  lowpass: "Low-pass",
  gate: "Noise gate",
  compressor: "Compressore",
  presence: "EQ presenza",
  normalize: "Normalizzazione",
};

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSelectedEffects() {
  return new Set(
    Array.from(effectsFieldset.querySelectorAll('input[name="fx"]:checked')).map(
      (input) => input.value,
    ),
  );
}

function stopPlayback() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      /* already stopped */
    }
    activeSource.disconnect();
    activeSource = null;
  }
  playStartCtxTime = null;
  playOffset = 0;
  playingKind = null;
  stopBtn.disabled = true;
  drawWaveform(waveOrigCanvas, originalBuffer, {
    progress: 0,
    accent: false,
  });
  drawWaveform(waveProcCanvas, processedBuffer, {
    progress: 0,
    accent: true,
  });
}

function updateUi() {
  const hasFile = Boolean(originalBuffer);
  const hasProc = Boolean(processedBuffer);
  const selected = getSelectedEffects();

  enhanceBtn.disabled = !hasFile || selected.size === 0;
  clearBtn.disabled = !hasFile;
  emptyEl.hidden = hasFile;
  panelEl.hidden = !hasFile;
  playOrigBtn.disabled = !hasFile;
  playProcBtn.disabled = !hasProc;
  downloadBtn.disabled = !hasProc;

  if (!hasFile) {
    metaEl.textContent = "Nessun file";
    origNameEl.textContent = "—";
    procStatusEl.textContent = "Non ancora elaborato";
    clearWaveform(waveOrigCanvas);
    clearWaveform(waveProcCanvas);
  }
}

function clearWaveform(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(16, 35, 28, 0.04)";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(16, 35, 28, 0.1)";
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {AudioBuffer | null} buffer
 * @param {{ progress?: number, accent?: boolean }} [opts]
 */
function drawWaveform(canvas, buffer, opts = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.width;
  const cssHeight = canvas.clientHeight || canvas.height;
  const width = Math.max(1, Math.floor(cssWidth * dpr));
  const height = Math.max(1, Math.floor(cssHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = opts.accent ? "rgba(15, 138, 95, 0.06)" : "rgba(16, 35, 28, 0.04)";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(16, 35, 28, 0.1)";
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  if (!buffer) return;

  const data = buffer.getChannelData(0);
  const samplesPerBar = Math.max(1, Math.floor(data.length / width));
  const mid = height / 2;
  const amp = height * 0.42;

  ctx.fillStyle = opts.accent ? "rgba(15, 138, 95, 0.75)" : "rgba(16, 35, 28, 0.55)";

  for (let x = 0; x < width; x += 1) {
    const start = x * samplesPerBar;
    let min = 1;
    let max = -1;
    const end = Math.min(data.length, start + samplesPerBar);
    for (let i = start; i < end; i += 1) {
      const sample = data[i];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    const y1 = mid + min * amp;
    const y2 = mid + max * amp;
    ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }

  const progress = Math.max(0, Math.min(1, opts.progress || 0));
  if (progress > 0) {
    const px = Math.floor(width * progress);
    ctx.fillStyle = "rgba(15, 138, 95, 0.18)";
    ctx.fillRect(0, 0, px, height);
    ctx.strokeStyle = "rgba(15, 138, 95, 0.95)";
    ctx.beginPath();
    ctx.moveTo(px + 0.5, 0);
    ctx.lineTo(px + 0.5, height);
    ctx.stroke();
  }
}

function tickPlaybackProgress() {
  if (!playCtx || playStartCtxTime === null || !playingKind) {
    rafId = null;
    return;
  }

  const buffer = playingKind === "orig" ? originalBuffer : processedBuffer;
  if (!buffer) {
    rafId = null;
    return;
  }

  const elapsed = playCtx.currentTime - playStartCtxTime + playOffset;
  const progress = Math.min(1, elapsed / buffer.duration);

  if (playingKind === "orig") {
    drawWaveform(waveOrigCanvas, originalBuffer, { progress, accent: false });
    drawWaveform(waveProcCanvas, processedBuffer, { progress: 0, accent: true });
  } else {
    drawWaveform(waveOrigCanvas, originalBuffer, { progress: 0, accent: false });
    drawWaveform(waveProcCanvas, processedBuffer, { progress, accent: true });
  }

  if (progress < 1 && activeSource) {
    rafId = requestAnimationFrame(tickPlaybackProgress);
  } else {
    rafId = null;
  }
}

async function ensurePlayContext() {
  if (!playCtx || playCtx.state === "closed") {
    playCtx = new AudioContext();
  }
  if (playCtx.state === "suspended") {
    await playCtx.resume();
  }
  return playCtx;
}

/**
 * @param {AudioBuffer} buffer
 * @param {"orig" | "proc"} kind
 */
async function playBuffer(buffer, kind) {
  if (!buffer) return;
  stopPlayback();
  const ctx = await ensurePlayContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => {
    if (activeSource === source) {
      activeSource = null;
      playStartCtxTime = null;
      playingKind = null;
      stopBtn.disabled = true;
      drawWaveform(waveOrigCanvas, originalBuffer, { progress: 0, accent: false });
      drawWaveform(waveProcCanvas, processedBuffer, { progress: 0, accent: true });
    }
  };
  activeSource = source;
  playingKind = kind;
  playOffset = 0;
  playStartCtxTime = ctx.currentTime;
  stopBtn.disabled = false;
  source.start(0);
  rafId = requestAnimationFrame(tickPlaybackProgress);
}

function applyGate(buffer, threshold, floor) {
  const sampleRate = buffer.sampleRate;
  const attack = Math.max(1, Math.floor(sampleRate * 0.008));
  const release = Math.max(1, Math.floor(sampleRate * 0.12));
  const out = new AudioBuffer({
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate,
  });

  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const input = buffer.getChannelData(ch);
    const output = out.getChannelData(ch);
    let envelope = 0;
    let gain = 1;

    for (let i = 0; i < input.length; i += 1) {
      const abs = Math.abs(input[i]);
      envelope =
        abs > envelope
          ? envelope + (abs - envelope) / attack
          : envelope + (abs - envelope) / release;

      const targetGain = envelope >= threshold ? 1 : floor;
      gain += (targetGain - gain) * (targetGain > gain ? 0.35 : 0.08);
      output[i] = input[i] * gain;
    }
  }

  return out;
}

function normalizeBuffer(buffer, targetPeak) {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i += 1) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  const out = new AudioBuffer({
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });

  if (peak < 1e-8) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
      out.copyToChannel(buffer.getChannelData(ch), ch);
    }
    return out;
  }

  const scale = Math.min(targetPeak / peak, 4);
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const input = buffer.getChannelData(ch);
    const output = out.getChannelData(ch);
    for (let i = 0; i < input.length; i += 1) {
      const sample = input[i] * scale;
      output[i] = Math.max(-1, Math.min(1, sample));
    }
  }
  return out;
}

function cloneBuffer(buffer) {
  const out = new AudioBuffer({
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    out.copyToChannel(buffer.getChannelData(ch), ch);
  }
  return out;
}

/**
 * @param {AudioBuffer} buffer
 * @param {typeof PRESETS.medium} preset
 * @param {Set<string>} effects
 */
async function enhanceVoice(buffer, preset, effects) {
  const needsOffline =
    effects.has("highpass") ||
    effects.has("lowpass") ||
    effects.has("presence") ||
    effects.has("compressor");

  let current = buffer;

  if (needsOffline) {
    const offline = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate,
    );

    const source = offline.createBufferSource();
    source.buffer = buffer;

    /** @type {AudioNode} */
    let node = source;

    if (effects.has("highpass")) {
      const highPass = offline.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.value = preset.highPass;
      highPass.Q.value = 0.707;
      node.connect(highPass);
      node = highPass;
    }

    if (effects.has("lowpass")) {
      const lowPass = offline.createBiquadFilter();
      lowPass.type = "lowpass";
      lowPass.frequency.value = preset.lowPass;
      lowPass.Q.value = 0.707;
      node.connect(lowPass);
      node = lowPass;
    }

    if (effects.has("presence")) {
      const presence = offline.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = preset.presenceFreq;
      presence.Q.value = 1.1;
      presence.gain.value = preset.presenceGain;
      node.connect(presence);
      node = presence;
    }

    if (effects.has("compressor")) {
      const compressor = offline.createDynamicsCompressor();
      compressor.threshold.value = preset.compressor.threshold;
      compressor.knee.value = preset.compressor.knee;
      compressor.ratio.value = preset.compressor.ratio;
      compressor.attack.value = preset.compressor.attack;
      compressor.release.value = preset.compressor.release;
      node.connect(compressor);
      node = compressor;
    }

    node.connect(offline.destination);
    source.start(0);
    current = await offline.startRendering();
  } else {
    current = cloneBuffer(buffer);
  }

  if (effects.has("gate")) {
    current = applyGate(current, preset.gateThreshold, preset.gateFloor);
  }

  if (effects.has("normalize")) {
    current = normalizeBuffer(current, preset.targetPeak);
  }

  return current;
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const samples = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i += 1) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let ch = 0; ch < numChannels; ch += 1) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < samples; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function markDirtyIfProcessed() {
  if (!processedBuffer) return;
  processedBuffer = null;
  procStatusEl.textContent = "Impostazioni cambiate — applica di nuovo gli effetti";
  drawWaveform(waveProcCanvas, null, { accent: true });
  updateUi();
}

async function loadFile(file) {
  showError("");
  stopPlayback();
  processedBuffer = null;

  const looksAudio =
    (file.type && file.type.startsWith("audio/")) ||
    /\.(mp3|wav|m4a|ogg|webm|aac)$/i.test(file.name);
  if (!file || !looksAudio) {
    showError("Seleziona un file audio (mp3, wav, m4a, ogg…).");
    return;
  }

  enhanceBtn.disabled = true;
  metaEl.textContent = "Caricamento…";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = await ensurePlayContext();
    originalBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    fileName = file.name;
    origNameEl.textContent = file.name;
    metaEl.textContent = `${file.name} · ${formatDuration(originalBuffer.duration)} · ${formatBytes(file.size)}`;
    procStatusEl.textContent = "Non ancora elaborato";
    updateUi();
    requestAnimationFrame(() => {
      drawWaveform(waveOrigCanvas, originalBuffer, { accent: false });
      drawWaveform(waveProcCanvas, null, { accent: true });
    });
  } catch {
    originalBuffer = null;
    fileName = "";
    showError("Il browser non riesce a leggere questo audio. Prova WAV o MP3.");
    updateUi();
  }
}

function clearAll() {
  stopPlayback();
  originalBuffer = null;
  processedBuffer = null;
  fileName = "";
  fileInput.value = "";
  showError("");
  updateUi();
}

async function runEnhance() {
  if (!originalBuffer) return;
  const effects = getSelectedEffects();
  if (effects.size === 0) {
    showError("Seleziona almeno un effetto.");
    return;
  }

  showError("");
  stopPlayback();
  enhanceBtn.disabled = true;
  enhanceBtn.textContent = "Elaborazione…";
  procStatusEl.textContent = "Elaborazione in corso…";

  try {
    const preset = PRESETS[intensitySelect.value] || PRESETS.medium;
    processedBuffer = await enhanceVoice(originalBuffer, preset, effects);
    const names = Array.from(effects)
      .map((key) => EFFECT_LABELS[key] || key)
      .join(", ");
    procStatusEl.textContent = `Pronto · ${names}`;
    drawWaveform(waveProcCanvas, processedBuffer, { accent: true });
    drawWaveform(waveOrigCanvas, originalBuffer, { accent: false });
  } catch {
    processedBuffer = null;
    procStatusEl.textContent = "Non ancora elaborato";
    drawWaveform(waveProcCanvas, null, { accent: true });
    showError("Elaborazione non riuscita. Riprova con un altro file.");
  } finally {
    enhanceBtn.textContent = "Applica effetti";
    updateUi();
  }
}

function downloadWav() {
  if (!processedBuffer) return;
  const blob = audioBufferToWav(processedBuffer);
  const base = fileName.replace(/\.[^.]+$/, "") || "voce";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${base}-limpida.wav`;
  link.click();
  URL.revokeObjectURL(link.href);
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) loadFile(file);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((type) => {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((type) => {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
  });
});

dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) loadFile(file);
});

enhanceBtn.addEventListener("click", runEnhance);
clearBtn.addEventListener("click", clearAll);
playOrigBtn.addEventListener("click", () => playBuffer(originalBuffer, "orig"));
playProcBtn.addEventListener("click", () => playBuffer(processedBuffer, "proc"));
downloadBtn.addEventListener("click", downloadWav);
stopBtn.addEventListener("click", stopPlayback);
intensitySelect.addEventListener("change", markDirtyIfProcessed);
effectsFieldset.addEventListener("change", () => {
  markDirtyIfProcessed();
  updateUi();
});

window.addEventListener("resize", () => {
  drawWaveform(waveOrigCanvas, originalBuffer, { accent: false });
  drawWaveform(waveProcCanvas, processedBuffer, { accent: true });
});

updateUi();
clearWaveform(waveOrigCanvas);
clearWaveform(waveProcCanvas);
