'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const userService = require('../services/userService');

router.get('/info', requireAuth, async (req, res) => {
  try {
    const info = await userService.getUserInfo(req.user.id);
    if (!info) return res.status(404).json({ message: 'User not found' });
    res.json(info);
  } catch (err) {
    console.error('Get user info error', err);
    res.status(500).json({ message: 'Failed to get user info' });
  }
});

module.exports = router;