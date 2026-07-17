const express = require('express');
const { body } = require('express-validator');
const { register, login, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  [
    body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
    body('email').trim().isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  register
);

router.post(
  '/login',
  authLimiter,
  [
    body('emailOrUsername').trim().notEmpty(),
    body('password').notEmpty(),
  ],
  login
);

router.get('/me', requireAuth, me);

module.exports = router;
