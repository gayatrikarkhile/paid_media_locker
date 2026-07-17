const mongoose = require('mongoose');

const unlockSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    media: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
    pricePaid: { type: Number, required: true },
  },
  { timestamps: true }
);

// A user can unlock a given piece of media at most once. This unique index
// is the authoritative guard against duplicate purchases - even under
// concurrent requests, Mongo will reject the second insert with E11000.
unlockSchema.index({ user: 1, media: 1 }, { unique: true });

module.exports = mongoose.model('Unlock', unlockSchema);
