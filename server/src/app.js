const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const { corsOrigin } = require('./config/env');
const { generalLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const walletRoutes = require('./routes/wallet.routes');
const mediaRoutes = require('./routes/media.routes');
const unlocksRoutes = require('./routes/unlocks.routes');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(mongoSanitize()); // strips $/. keys from req.body/query to block NoSQL injection
  app.use(morgan('dev'));
  app.use(generalLimiter);

  // NOTE: there is intentionally NO express.static() mount for the
  // uploads/ directory. Every file access goes through
  // /api/media/:id/file, which performs an auth + ownership/unlock check
  // on every single request. This is the core of the "no direct access
  // to original files" security requirement.

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/unlocks', unlocksRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
