'use strict';

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'please-change-this-secret';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function signAccess(payload, options = {}) {
  return jwt.sign(payload, SECRET, { expiresIn: ACCESS_EXPIRES_IN, ...options });
}

function signRefresh(payload, options = {}) {
  return jwt.sign(payload, SECRET, { expiresIn: REFRESH_EXPIRES_IN, ...options });
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signAccess, signRefresh, verify, ACCESS_EXPIRES_IN, REFRESH_EXPIRES_IN };