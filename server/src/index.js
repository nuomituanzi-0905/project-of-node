'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
dotenv.config();

const { initDbIfNeeded } = require('./services/db');
const { createRedisClient } = require('./config/redis');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * parseBoolEnv("true"|"1"|"yes") => true, else false
 */
function parseBoolEnv(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

async function main() {
  await initDbIfNeeded();
  await createRedisClient();

  const app = express();

  // Trust proxy only when TRUST_PROXY is explicitly set
  const trustProxyEnv = process.env.TRUST_PROXY;
  const enableTrustProxy = parseBoolEnv(trustProxyEnv);

  if (enableTrustProxy) {
    app.set('trust proxy', true);
    console.log('Express trust proxy is ENABLED (req.ip and X-Forwarded-* will be trusted)');
  } else {
    console.log('Express trust proxy is DISABLED (req.ip will not trust X-Forwarded-*)');
  }

  app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});