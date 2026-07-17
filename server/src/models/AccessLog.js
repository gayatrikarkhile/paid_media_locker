const mongoose = require('mongoose');

// Bonus: lightweight audit trail of who accessed which file, and whether
// it was an original or a preview. Useful for detecting URL-sharing abuse
// (e.g. same signed token pattern hit from many different IPs).
const accessLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    media: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
    variant: { type: String, enum: ['original', 'preview'], required: true },
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('AccessLog', accessLogSchema);
