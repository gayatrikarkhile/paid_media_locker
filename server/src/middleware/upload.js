const multer = require('multer');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

// Buffer storage: we never trust or persist the client's filename, and we
// don't write to disk until after validation + our own preview pipeline
// has run (see services/media.service.js). This also avoids partially
// written files on validation failure.
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new ApiError(400, 'Only JPEG, PNG, or WEBP images are allowed'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

module.exports = upload;
