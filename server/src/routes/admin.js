'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.get('/panel', requireAuth, requireRole('admin'), async (req, res) => {
  res.json({ message: `Welcome to admin panel, ${req.user.name}`, user: req.user });
});

module.exports = router;