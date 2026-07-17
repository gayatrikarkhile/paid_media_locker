const rateLimit = require('express-rate-limit');

// Tighter limits on auth endpoints to slow down credential stuffing / brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// Unlock is a "spend money" action - keep it modest to blunt scripted abuse.
const unlockLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many unlock attempts, slow down.' },
});

// General API limiter as a baseline safety net.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, unlockLimiter, generalLimiter };
