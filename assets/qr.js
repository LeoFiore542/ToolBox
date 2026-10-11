import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";

const form = document.getElementById("qr-form");
const urlInput = document.getElementById("qr-url");
const sizeSelect = document.getElementById("qr-size");
const errorEl = document.getElementById("qr-error");
const canvas = document.getElementById("qr-canvas");
const placeholder = document.getElementById("qr-placeholder");
const downloadBtn = document.getElementById("qr-download");

if (!form) {
  throw new Error("Form generatore QR non trovato.");
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

function setPreviewVisible(visible) {
  canvas.hidden = !visible;
  placeholder.hidden = visible;
  downloadBtn.disabled = !visible;
}

async function generateQr(event) {
  event.preventDefault();
  showError("");

  const raw = urlInput.value;
  if (!raw.trim()) {
    showError("Inserisci un link.");
    setPreviewVisible(false);
    return;
  }

  const url = normalizeUrl(raw);
  try {
    new URL(url);
  } catch {
    showError("Il link non sembra valido.");
    setPreviewVisible(false);
    return;
  }

  const size = Number(sizeSelect.value) || 512;

  try {
    await QRCode.toCanvas(canvas, url, {
      width: size,
      margin: 2,
      color: {
        dark: "#10231c",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });
    urlInput.value = url;
    setPreviewVisible(true);
  } catch {
    showError("Non sono riuscito a generare il QR. Riprova.");
    setPreviewVisible(false);
  }
}

function downloadPng() {
  if (canvas.hidden) return;
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.download = `toolbox-qr-${stamp}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

form.addEventListener("submit", generateQr);
downloadBtn.addEventListener("click", downloadPng);
setPreviewVisible(false);
