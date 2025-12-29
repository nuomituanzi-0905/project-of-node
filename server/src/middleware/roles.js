'use strict';

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (!req.user.roles.includes(role)) {
      return res.status(403).json({ message: 'Forbidden - missing role' });
    }
    next();
  };
}

function requireAnyRole(roles = []) {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const ok = roles.some((r) => req.user.roles.includes(r));
    if (!ok) return res.status(403).json({ message: 'Forbidden - missing required role' });
    next();
  };
}

module.exports = { requireRole, requireAnyRole };