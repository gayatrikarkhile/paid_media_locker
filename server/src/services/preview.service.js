const sharp = require('sharp');
const { previewMaxWidth, previewJpegQuality } = require('../config/env');

// Generate a strongly blurred preview image
async function generatePreview(inputBuffer) {
  const previewBuffer = await sharp(inputBuffer)
    .rotate() // Fix image orientation
    .resize({
      width: previewMaxWidth,
      withoutEnlargement: true,
    })
    .blur(5) // Increase to 40-50 if you want even more blur
    .jpeg({
      quality: 10, // Low quality makes it even harder to see
    })
    .withMetadata({}) // Remove EXIF/GPS metadata
    .toBuffer();

  return previewBuffer;
}

// Sanitize original image (remove metadata but keep quality)
async function sanitizeOriginal(inputBuffer, mimeType) {
  const img = sharp(inputBuffer).rotate();
  const meta = await sharp(inputBuffer).metadata();

  let pipeline;

  if (mimeType === 'image/png') {
    pipeline = img.png();
  } else if (mimeType === 'image/webp') {
    pipeline = img.webp({ quality: 90 });
  } else {
    pipeline = img.jpeg({ quality: 92 });
  }

  const buffer = await pipeline.withMetadata({}).toBuffer();

  return {
    buffer,
    width: meta.width,
    height: meta.height,
  };
}

module.exports = {
  generatePreview,
  sanitizeOriginal,
};