require('dotenv').config();

function required(name, fallback) {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/paid_media_locker'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  fileTokenSecret: required('FILE_TOKEN_SECRET'),
  fileTokenTtlSeconds: Number(process.env.FILE_TOKEN_TTL_SECONDS || 60),
  startingBalance: Number(process.env.STARTING_BALANCE || 100),
  previewMaxWidth: Number(process.env.PREVIEW_MAX_WIDTH || 480),
  previewJpegQuality: Number(process.env.PREVIEW_JPEG_QUALITY || 45),
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
