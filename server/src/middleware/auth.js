const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Verifies the Bearer JWT and attaches req.user (a lean, safe user doc).
// This is the single choke point for "is this request authenticated".
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, 'User for this token no longer exists');
  }

  req.user = user;
  next();
});

// Same idea as requireAuth, but never throws - just leaves req.user
// unset if there's no/invalid Bearer token. Used on the file-delivery
// route, which also accepts a short-lived signed ?token= instead.
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, jwtSecret);
      const user = await User.findById(payload.sub);
      if (user) req.user = user;
    } catch (err) {
      // ignore - fall through unauthenticated, getFile() will require ?token=
    }
  }
  next();
});

module.exports = { requireAuth, optionalAuth };
