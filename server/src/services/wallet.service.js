const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');

// Atomic credit: increments balance in a single findOneAndUpdate so
// concurrent credits can't clobber each other (no read-modify-write race).
async function credit(userId, amount, reason, session) {
  if (amount <= 0) throw new ApiError(400, 'Credit amount must be positive');

  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { walletBalance: amount } },
    { new: true, session }
  );
  if (!user) throw new ApiError(404, 'User not found');

  await Transaction.create(
    [
      {
        user: userId,
        type: 'CREDIT',
        amount,
        balanceAfter: user.walletBalance,
        reason,
      },
    ],
    { session }
  );

  return user;
}

// Atomic, guarded debit: the balance check happens *inside* the same
// MongoDB update operation (balance >= amount as a query filter), so two
// simultaneous requests can't both succeed and drive the balance negative.
// If the filter doesn't match (insufficient funds), findOneAndUpdate
// returns null and we surface a 402.
async function debit(userId, amount, reason, relatedMedia, session) {
  if (amount <= 0) throw new ApiError(400, 'Debit amount must be positive');

  const user = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: amount } },
    { $inc: { walletBalance: -amount } },
    { new: true, session }
  );

  if (!user) {
    throw new ApiError(402, 'Insufficient wallet balance');
  }

  await Transaction.create(
    [
      {
        user: userId,
        type: 'DEBIT',
        amount,
        balanceAfter: user.walletBalance,
        reason,
        relatedMedia: relatedMedia || null,
      },
    ],
    { session }
  );

  return user;
}

module.exports = { credit, debit };
