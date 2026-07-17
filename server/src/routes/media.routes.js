const express = require('express');
const { body, param, query } = require('express-validator');
const mediaController = require('../controllers/media.controller');
const unlockController = require('../controllers/unlock.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { unlockLimiter } = require('../middleware/rateLimiters');
const uploadMiddleware = require('../middleware/upload');

const router = express.Router();

const mongoIdParam = param('id').isMongoId().withMessage('Invalid media id');

router.post(
  '/',
  requireAuth,
  uploadMiddleware.single('image'),
  [
    body('title').trim().isLength({ min: 1, max: 120 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('unlockPrice').isFloat({ min: 0 }).withMessage('unlockPrice must be a non-negative number'),
  ],
  mediaController.upload
);

router.get('/', requireAuth, [query('page').optional().isInt({ min: 1 })], mediaController.list);

router.get('/:id', requireAuth, [mongoIdParam], mediaController.getById);

router.get(
  '/:id/access-url',
  requireAuth,
  [mongoIdParam, query('variant').optional().isIn(['preview', 'original'])],
  mediaController.getAccessUrl
);

// optionalAuth: this route is reached either with a normal Bearer token,
// or with a short-lived ?token=, so auth here must not hard-fail.
router.get(
  '/:id/file',
  optionalAuth,
  [mongoIdParam, query('variant').optional().isIn(['preview', 'original'])],
  mediaController.getFile
);

router.post('/:id/unlock', requireAuth, unlockLimiter, [mongoIdParam], unlockController.unlock);

//this for delete
router.delete(
  "/:id",
  requireAuth,
  [mongoIdParam],
  mediaController.deleteMedia
);

module.exports = router;
