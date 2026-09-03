"use client";

// Turns a user-picked image file into a data URL that is safe to store in a Postgres
// text column. Everything in this app stores images inline (patients.photo_data_url,
// payments.screenshot_data_url, doctors.qr_code_url) rather than in object storage, so
// the size of what gets encoded here is the size of the row every later SELECT pulls
// back. A raw 5 MB phone photo becomes ~6.7 MB of base64; downscaling first keeps that
// in the tens of kilobytes.
//
// Returns a JPEG data URL. Rejects with a message meant for the user.

const DEFAULT_MAX_DIMENSION = 800;
const DEFAULT_QUALITY = 0.9;
// Generous ceiling -- a downscaled image lands far under this. It only ever trips on
// something pathological, and catches it before it reaches the database.
const DEFAULT_MAX_BYTES = 700 * 1024;

export async function fileToCompressedDataUrl(file, options = {}) {
  const {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
    maxBytes = DEFAULT_MAX_BYTES,
  } = options;

  if (!file) throw new Error("No file selected.");
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const sourceDataUrl = await readAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  // Transparent PNGs (common for QR exports) would otherwise flatten to black on a
  // JPEG, which no scanner can read.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);

  if (approximateByteLength(dataUrl) > maxBytes) {
    throw new Error("That image is too large even after resizing. Please choose a smaller one.");
  }

  return dataUrl;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that file. Please try another image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file doesn't look like a valid image."));
    image.src = dataUrl;
  });
}

// A data URL is base64 after the comma: 4 characters per 3 bytes, minus padding.
function approximateByteLength(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
