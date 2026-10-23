import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";

const dropzone = document.getElementById("pdf-dropzone");
const fileInput = document.getElementById("pdf-files");
const listEl = document.getElementById("pdf-list");
const emptyEl = document.getElementById("pdf-empty");
const errorEl = document.getElementById("pdf-error");
const countEl = document.getElementById("pdf-count");
const clearBtn = document.getElementById("pdf-clear");
const createBtn = document.getElementById("pdf-create");
const pageSelect = document.getElementById("pdf-page");

/** @type {{ id: string, file: File, url: string }[]} */
let images = [];

if (!dropzone || !fileInput || !listEl) {
  throw new Error("Convertitore Foto → PDF non trovato.");
}

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

function updateActions() {
  const hasImages = images.length > 0;
  createBtn.disabled = !hasImages;
  clearBtn.disabled = !hasImages;
  emptyEl.hidden = hasImages;
  countEl.textContent = hasImages
    ? `${images.length} foto selezionat${images.length === 1 ? "a" : "e"}`
    : "Nessuna foto";
}

function renderList() {
  listEl.replaceChildren();

  for (const item of images) {
    const row = document.createElement("li");
    row.className = "pdf-item";
    row.dataset.id = item.id;

    const thumb = document.createElement("img");
    thumb.src = item.url;
    thumb.alt = "";
    thumb.className = "pdf-thumb";

    const meta = document.createElement("div");
    meta.className = "pdf-item-meta";

    const name = document.createElement("p");
    name.className = "pdf-item-name";
    name.textContent = item.file.name;

    const size = document.createElement("p");
    size.className = "pdf-item-size";
    size.textContent = formatBytes(item.file.size);

    meta.append(name, size);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn pdf-item-remove";
    remove.setAttribute("aria-label", `Rimuovi ${item.file.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => removeImage(item.id));

    row.append(thumb, meta, remove);
    listEl.append(row);
  }

  updateActions();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function removeImage(id) {
  const index = images.findIndex((item) => item.id === id);
  if (index === -1) return;
  URL.revokeObjectURL(images[index].url);
  images.splice(index, 1);
  renderList();
  showError("");
}

function clearImages() {
  for (const item of images) URL.revokeObjectURL(item.url);
  images = [];
  fileInput.value = "";
  renderList();
  showError("");
}

function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) {
    showError("Seleziona almeno un’immagine (JPG, PNG, WebP…).");
    return;
  }

  showError("");
  for (const file of files) {
    images.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      url: URL.createObjectURL(file),
    });
  }
  renderList();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossibile leggere un’immagine."));
    img.src = url;
  });
}

async function imageToJpegDataUrl(url) {
  const img = await loadImage(url);
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), width, height };
}

async function createPdf() {
  if (!images.length) {
    showError("Aggiungi almeno una foto.");
    return;
  }

  showError("");
  createBtn.disabled = true;
  createBtn.textContent = "Creazione…";

  try {
    const pageFormat = pageSelect.value === "letter" ? "letter" : "a4";
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: pageFormat,
      compress: true,
    });

    const margin = 10;

    for (let i = 0; i < images.length; i += 1) {
      const item = images[i];
      const { dataUrl, width, height } = await imageToJpegDataUrl(item.url);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      const ratio = Math.min(maxWidth / width, maxHeight / height);
      const drawWidth = width * ratio;
      const drawHeight = height * ratio;
      const x = (pageWidth - drawWidth) / 2;
      const y = (pageHeight - drawHeight) / 2;

      if (i > 0) doc.addPage(pageFormat, "portrait");
      doc.addImage(dataUrl, "JPEG", x, y, drawWidth, drawHeight, undefined, "FAST");
    }

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`toolbox-foto-${stamp}.pdf`);
  } catch {
    showError("Non sono riuscito a creare il PDF. Riprova con altre immagini.");
  } finally {
    createBtn.textContent = "Crea PDF";
    updateActions();
  }
}

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
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
  addFiles(event.dataTransfer?.files);
});

clearBtn.addEventListener("click", clearImages);
createBtn.addEventListener("click", createPdf);

updateActions();
