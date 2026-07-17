const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, required: true }, // e.g. "SIGNUP_BONUS", "UNLOCK_MEDIA"
    relatedMedia: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
