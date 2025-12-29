'use strict';

const tokenService = require('../services/tokenService');
const db = require('../services/db');

function extractTokenFromHeader(req) {
  const h = req.headers.authorization || '';
  if (!h) return null;
  const parts = h.split(' ');
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return null;
  return token;
}

async function requireAuth(req, res, next) {
  try {
    const token = extractTokenFromHeader(req);
    if (!token) return res.status(401).json({ message: 'No token provided' });

    let payload;
    try {
      payload = await tokenService.validateAccessToken(token);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired access token' });
    }

    const user = await db.getUserById(payload.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.user = { id: user.id, username: user.username, roles: user.roles, name: user.name };
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error', err);
    res.status(500).json({ message: 'Auth error' });
  }
}

module.exports = { requireAuth, extractTokenFromHeader };