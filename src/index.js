'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
dotenv.config();
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const { initDbIfNeeded } = require('./services/db');
const { createRedisClient } = require('./config/redis');

const PORT = process.env.PORT || 4000;

async function main() {
  await initDbIfNeeded(); // ensures sample data exists
  await createRedisClient(); // connect to redis

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start app', err);
  process.exit(1);
});