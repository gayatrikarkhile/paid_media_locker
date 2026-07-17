const express = require('express');
const { myUnlocks } = require('../controllers/unlock.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, myUnlocks);

module.exports = router;
