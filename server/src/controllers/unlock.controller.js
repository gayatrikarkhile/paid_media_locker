const Media = require('../models/Media');
const Unlock = require('../models/Unlock');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const walletService = require('../services/wallet.service');

// Purchase flow, in order:
//  1. Insert the Unlock row FIRST. Its unique (user, media) index is the
//     authoritative guard against duplicate purchases - even if two
//     requests race each other, Mongo only lets one insert succeed.
//  2. Debit the wallet with a conditional ($gte) update, so balance can
//     never go negative even under concurrent unlocks of different media.
//  3. If the debit fails (insufficient funds), roll back step 1 by
//     deleting the Unlock row we just inserted, then return 402.
// (On a replica-set Mongo deployment this would instead be one multi-doc
// transaction; see README for notes on that tradeoff for a single-node
// local Mongo used in this assignment.)
const unlock = asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media) throw new ApiError(404, 'Media not found');

  if (String(media.owner) === String(req.user._id)) {
    throw new ApiError(400, 'You already own this media');
  }

  let unlockDoc;
  try {
    unlockDoc = await Unlock.create({
      user: req.user._id,
      media: media._id,
      pricePaid: media.unlockPrice,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'You have already unlocked this media');
    }
    throw err;
  }

  try {
    const user = await walletService.debit(
      req.user._id,
      media.unlockPrice,
      'UNLOCK_MEDIA',
      media._id
    );
    return res.status(201).json({
      unlocked: true,
      walletBalance: user.walletBalance,
      media: { id: media._id, title: media.title },
    });
  } catch (err) {
    // Compensating rollback - purchase never actually happened.
    await Unlock.deleteOne({ _id: unlockDoc._id });
    throw err;
  }
});

const myUnlocks = asyncHandler(async (req, res) => {
  const unlocks = await Unlock.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate('media', 'title unlockPrice');

  res.json({
    items: unlocks.map((u) => ({
      id: u._id,
      media: u.media ? { id: u.media._id, title: u.media.title, unlockPrice: u.media.unlockPrice } : null,
      pricePaid: u.pricePaid,
      unlockedAt: u.createdAt,
    })),
  });
});

module.exports = { unlock, myUnlocks };
