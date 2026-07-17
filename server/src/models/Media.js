const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    unlockPrice: { type: Number, required: true, min: 0 },

    // Server-generated, randomized filenames. NEVER derived from user input,
    // to avoid path traversal / predictable-URL guessing.
    originalStorageKey: { type: String, required: true }, // path under uploads/originals
    previewStorageKey: { type: String, required: true }, // path under uploads/previews
    mimeType: { type: String, required: true },
    originalFilename: { type: String }, // just for display purposes

    width: Number,
    height: Number,
  },
  { timestamps: true }
);

mediaSchema.methods.toFeedJSON = function toFeedJSON(unlockedMediaIds) {
  const unlocked = unlockedMediaIds.has(String(this._id));
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    unlockPrice: this.unlockPrice,
    owner: this.owner,
    isUnlocked: unlocked,
    createdAt: this.createdAt,
    // The client always fetches the preview through the authenticated
    // /media/:id/file?variant=preview endpoint - never a static URL.
  };
};

module.exports = mongoose.model('Media', mediaSchema);
