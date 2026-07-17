const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');

const getBalance = asyncHandler(async (req, res) => {
  res.json({ walletBalance: req.user.walletBalance });
});

const getTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const [items, total] = await Promise.all([
    Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('relatedMedia', 'title'),
    Transaction.countDocuments({ user: req.user._id }),
  ]);

  res.json({
    page,
    limit,
    total,
    items: items.map((t) => ({
      id: t._id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      reason: t.reason,
      relatedMedia: t.relatedMedia ? { id: t.relatedMedia._id, title: t.relatedMedia.title } : null,
      createdAt: t.createdAt,
    })),
  });
});

module.exports = { getBalance, getTransactions };
