const express = require('express');
const { getBalance, getTransactions } = require('../controllers/wallet.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/balance', getBalance);
router.get('/transactions', getTransactions);

module.exports = router;
