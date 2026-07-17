const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default
    },
    walletBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Never leak the hash even if select() is forced elsewhere
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    walletBalance: this.walletBalance,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
