const multer = require('multer');
const ApiError = require('../utils/ApiError');

function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.message });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate resource / already exists' });
  }

  console.error('[unhandled error]', err);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { notFound, errorHandler };
