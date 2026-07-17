const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Media = require('../models/Media');
const Unlock = require('../models/Unlock');
const AccessLog = require('../models/AccessLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const storage = require('../services/storage.service');
const preview = require('../services/preview.service');
const signedUrl = require('../services/signedUrl.service');

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }
}

// ---- Upload -----------------------------------------------------------

const upload = asyncHandler(async (req, res) => {
  checkValidation(req);
  if (!req.file) throw new ApiError(400, 'An "image" file is required');

  const { title, description = '', unlockPrice } = req.body;
  const price = Number(unlockPrice);

  const { buffer: cleanOriginal, width, height } = await preview.sanitizeOriginal(
    req.file.buffer,
    req.file.mimetype
  );
  const previewBuffer = await preview.generatePreview(req.file.buffer);

  const originalStorageKey = await storage.writeOriginal(cleanOriginal, req.file.mimetype);
  const previewStorageKey = await storage.writePreview(previewBuffer);

  const media = await Media.create({
    owner: req.user._id,
    title,
    description,
    unlockPrice: price,
    originalStorageKey,
    previewStorageKey,
    mimeType: req.file.mimetype,
    originalFilename: req.file.originalname,
    width,
    height,
  });

  res.status(201).json({ media: publicMediaJSON(media, { isUnlocked: true, isOwner: true }) });
});

// ---- Feed ---------------------------------------------------------------

const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const [items, total, myUnlocks] = await Promise.all([
    Media.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'username'),
    Media.countDocuments({}),
    Unlock.find({ user: req.user._id }).select('media').lean(),
  ]);

  const unlockedSet = new Set(myUnlocks.map((u) => String(u.media)));

  res.json({
    page,
    limit,
    total,
    items: items.map((m) =>
      publicMediaJSON(m, {
        isUnlocked: unlockedSet.has(String(m._id)) || String(m.owner._id) === String(req.user._id),
        isOwner: String(m.owner._id) === String(req.user._id),
      })
    ),
  });
});

const getById = asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id).populate('owner', 'username');
  if (!media) throw new ApiError(404, 'Media not found');

  const isOwner = String(media.owner._id) === String(req.user._id);
  const isUnlocked =
    isOwner || !!(await Unlock.exists({ user: req.user._id, media: media._id }));

  res.json({ media: publicMediaJSON(media, { isUnlocked, isOwner }) });
});

// ---- Secure delivery ------------------------------------------------------

// Returns a short-lived signed URL for either the preview or (if the
// caller owns / has unlocked the media) the original. Access rights are
// evaluated ONCE, at issuance time, and re-checked again when the token is
// redeemed in getFile() below - so a token can never outlive the access
// grant it represents by more than fileTokenTtlSeconds.
const getAccessUrl = asyncHandler(async (req, res) => {
  const variant = req.query.variant === 'original' ? 'original' : 'preview';
  const media = await Media.findById(req.params.id);
  if (!media) throw new ApiError(404, 'Media not found');

  const isOwner = String(media.owner) === String(req.user._id);

  if (variant === 'original') {
    const unlocked = isOwner || (await Unlock.exists({ user: req.user._id, media: media._id }));
    if (!unlocked) {
      throw new ApiError(403, 'You must unlock this media before accessing the original');
    }
  }

  const token = signedUrl.issueFileToken({
    userId: req.user._id.toString(),
    mediaId: media._id.toString(),
    variant,
  });

  res.json({
    url: `/api/media/${media._id}/file?variant=${variant}&token=${token}`,
    expiresInSeconds: 60,
  });
});

// Streams the actual bytes. Accepts EITHER:
//   (a) a short-lived ?token= issued by getAccessUrl, or
//   (b) a normal Authorization: Bearer <login JWT> header (re-checked live)
// Either path re-validates ownership/unlock status - a token never bypasses
// the underlying access rule, it just avoids a second round trip.
const getFile = asyncHandler(async (req, res) => {
  const variant = req.query.variant === 'original' ? 'original' : 'preview';
  const media = await Media.findById(req.params.id);
  if (!media) throw new ApiError(404, 'Media not found');

  let userId;

  if (req.query.token) {
    let payload;
    try {
      payload = signedUrl.verifyFileToken(req.query.token);
    } catch (err) {
      throw new ApiError(401, 'Access link expired or invalid - please request a new one');
    }
    if (payload.mid !== String(media._id) || payload.variant !== variant) {
      throw new ApiError(403, 'This access link is not valid for the requested file');
    }
    userId = payload.uid;
  } else if (req.user) {
    userId = String(req.user._id);
  } else {
    throw new ApiError(401, 'Authentication required');
  }

  if (variant === 'original') {
    const isOwner = String(media.owner) === userId;
    const unlocked = isOwner || (await Unlock.exists({ user: userId, media: media._id }));
    if (!unlocked) throw new ApiError(403, 'This media has not been unlocked');
  }

  AccessLog.create({
    user: userId,
    media: media._id,
    variant,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {}); // best-effort audit log, never block the response on it

  res.setHeader('Cache-Control', 'private, max-age=30');
  res.setHeader('Content-Type', variant === 'preview' ? 'image/jpeg' : media.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream =
    variant === 'preview'
      ? storage.readPreviewStream(media.previewStorageKey)
      : storage.readOriginalStream(media.originalStorageKey);

  stream.on('error', () => res.status(404).end());
  stream.pipe(res);
});

function publicMediaJSON(media, { isUnlocked, isOwner }) {
  return {
    id: media._id,
    title: media.title,
    description: media.description,
    unlockPrice: media.unlockPrice,
    owner: media.owner && media.owner.username ? { id: media.owner._id, username: media.owner.username } : media.owner,
    isUnlocked,
    isOwner,
    width: media.width,
    height: media.height,
    createdAt: media.createdAt,
  };

}


const deleteMedia = asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    throw new ApiError(404, "Media not found");
  }

  if (String(media.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You can only delete your own media");
  }

  await media.deleteOne();

  res.json({
    success: true,
    message: "Media deleted successfully",
  });
});

module.exports = { upload, list, getById, getAccessUrl, getFile,  deleteMedia };
