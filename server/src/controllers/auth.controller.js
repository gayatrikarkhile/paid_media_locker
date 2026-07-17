const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const walletService = require('../services/wallet.service');
const { jwtSecret, jwtExpiresIn, startingBalance } = require('../config/env');

const BCRYPT_ROUNDS = 12;

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }
}

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString() }, jwtSecret, { expiresIn: jwtExpiresIn });
}

const register = asyncHandler(async (req, res) => {
  checkValidation(req);
  const { username, email, password } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    throw new ApiError(409, 'A user with that email or username already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ username, email, passwordHash, walletBalance: 0 });

  // Predefined starting balance, granted as a real ledger entry so it
  // shows up in transaction history like any other credit.
  await walletService.credit(user._id, startingBalance, 'SIGNUP_BONUS');
  const fresh = await User.findById(user._id);

  const token = issueToken(fresh);
  res.status(201).json({ token, user: fresh.toSafeJSON() });
});

const login = asyncHandler(async (req, res) => {
  checkValidation(req);
  const { emailOrUsername, password } = req.body;

  const user = await User.findOne({
    $or: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }],
  }).select('+passwordHash');

  // Same error for "no such user" and "wrong password" - don't leak which
  // one it was, that's an account-enumeration vector.
  if (!user) throw new ApiError(401, 'Invalid credentials');

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new ApiError(401, 'Invalid credentials');

  const token = issueToken(user);
  res.json({ token, user: user.toSafeJSON() });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = { register, login, me };
