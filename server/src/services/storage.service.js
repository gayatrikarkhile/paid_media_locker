const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// IMPORTANT: this directory is never registered with express.static().
// The only way to read a file back out is through storage.service's own
// readStream(), which is only called from controllers that have already
// verified ownership/unlock status. This is what stops "direct access to
// original files" - there is no public URL for them at all.
const ROOT = path.join(__dirname, '..', '..', 'uploads');
const ORIGINALS_DIR = path.join(ROOT, 'originals');
const PREVIEWS_DIR = path.join(ROOT, 'previews');

for (const dir of [ORIGINALS_DIR, PREVIEWS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function extFor(mimeType) {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

// Generates a random, unguessable storage key. We deliberately never use
// the user-supplied filename anywhere in the path (avoids path traversal
// like "../../etc/passwd" and avoids leaking info via predictable names).
function randomKey(mimeType) {
  return `${uuidv4()}.${extFor(mimeType)}`;
}

function originalAbsPath(storageKey) {
  return path.join(ORIGINALS_DIR, storageKey);
}

function previewAbsPath(storageKey) {
  return path.join(PREVIEWS_DIR, storageKey);
}

async function writeOriginal(buffer, mimeType) {
  const key = randomKey(mimeType);
  await fs.promises.writeFile(originalAbsPath(key), buffer);
  return key;
}

async function writePreview(buffer) {
  // Previews are always normalized to jpeg by the preview service.
  const key = `${uuidv4()}.jpg`;
  await fs.promises.writeFile(previewAbsPath(key), buffer);
  return key;
}

function readOriginalStream(storageKey) {
  return fs.createReadStream(originalAbsPath(storageKey));
}

function readPreviewStream(storageKey) {
  return fs.createReadStream(previewAbsPath(storageKey));
}

module.exports = {
  writeOriginal,
  writePreview,
  readOriginalStream,
  readPreviewStream,
  originalAbsPath,
  previewAbsPath,
};
