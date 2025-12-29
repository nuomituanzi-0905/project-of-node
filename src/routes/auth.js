'use strict';

const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const tokenService = require('../services/tokenService');
const { requireAuth, extractTokenFromHeader } = require('../middleware/auth');
const { createRedisSubscriber } = require('../config/redis');
const { verify } = require('../config/jwt');

const COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'refreshToken';
const COOKIE_SECURE = (process.env.COOKIE_SECURE === 'true') || (process.env.NODE_ENV === 'production');
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'Lax';
const REFRESH_TTL = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || `${7 * 24 * 3600}`, 10);

/**
 * Helper to set refresh cookie
 */
function setRefreshCookie(res, refreshToken) {
  res.cookie(COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    maxAge: REFRESH_TTL * 1000,
    path: '/'
  });
}

/**
 * Helper to clear refresh cookie
 */
function clearRefreshCookie(res) {
  res.cookie(COOKIE_NAME, '', { httpOnly: true, secure: COOKIE_SECURE, sameSite: COOKIE_SAMESITE, maxAge: 0, path: '/' });
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'username and password required' });

    const user = await userService.register({ username, password, name });
    res.status(201).json({ message: 'user created', user: { id: user.id, username: user.username, name: user.name } });
  } catch (err) {
    console.error('Register error', err);
    res.status(400).json({ message: err.message || 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * returns { accessToken }
 * sets refresh token as httpOnly cookie
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'username and password required' });

    const user = await userService.authenticate({ username, password });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const accessToken = await tokenService.createAccessToken(user.id);

    // capture client metadata
    const ip = req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    const userAgent = req.get('User-Agent') || null;

    const { token: refreshToken } = await tokenService.createRefreshToken(user.id, { ip, userAgent });

    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh
 * rotates refresh token stored in cookie and returns new accessToken (and sets new refresh cookie)
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies[COOKIE_NAME];
    if (!refreshToken) return res.status(400).json({ message: 'refresh token cookie required' });

    try {
      const tokens = await tokenService.rotateRefreshToken(refreshToken);
      // tokens: { accessToken, refreshToken }
      setRefreshCookie(res, tokens.refreshToken);
      return res.json({ accessToken: tokens.accessToken });
    } catch (err) {
      console.error('Refresh error', err);
      // Clear cookie in case of invalid reuse
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Refresh token invalid or expired' });
    }
  } catch (err) {
    console.error('Refresh endpoint error', err);
    res.status(500).json({ message: 'Failed to refresh token' });
  }
});

/**
 * POST /api/auth/logout
 * revoke access token and all refresh tokens for the user and clear cookie
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const accessToken = extractTokenFromHeader(req);
    await tokenService.revokeAccessToken(accessToken);
    await tokenService.revokeAllRefreshTokensForUser(req.user.id);
    clearRefreshCookie(res);
    res.json({ message: 'Logged out (access token revoked and refresh tokens cleared)' });
  } catch (err) {
    console.error('Logout error', err);
    res.status(500).json({ message: 'Logout failed' });
  }
});

/**
 * GET /api/auth/sessions
 * returns active refresh sessions for the authenticated user, each with isCurrent flag and device/ip metadata
 */
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await tokenService.listRefreshTokensForUser(req.user.id);

    // Determine current jti from cookie, if present
    const cookie = req.cookies[COOKIE_NAME];
    let currentJti = null;
    if (cookie) {
      try {
        const decoded = verify(cookie);
        currentJti = decoded && decoded.jti ? decoded.jti : null;
      } catch (e) {
        currentJti = null;
      }
    }

    const enriched = sessions.map((s) => ({ ...s, isCurrent: currentJti === s.jti }));
    res.json({ sessions: enriched });
  } catch (err) {
    console.error('List sessions error', err);
    res.status(500).json({ message: 'Failed to list sessions' });
  }
});

/**
 * DELETE /api/auth/sessions/:jti
 * revoke a single refresh token (session) for the authenticated user
 * If revoking the current cookie's session, clear the cookie and return isCurrent:true
 */
router.delete('/sessions/:jti', requireAuth, async (req, res) => {
  try {
    const { jti } = req.params;
    if (!jti) return res.status(400).json({ message: 'jti required' });

    // ensure the jti belongs to this user
    const sessions = await tokenService.listRefreshTokensForUser(req.user.id);
    const found = sessions.find((s) => s.jti === jti);
    if (!found) return res.status(404).json({ message: 'Session not found' });

    const ok = await tokenService.revokeRefreshTokenByJti(jti);
    if (!ok) return res.status(400).json({ message: 'Failed to revoke session' });

    // if the cookie contains the same jti, clear the cookie
    const cookie = req.cookies[COOKIE_NAME];
    let isCurrent = false;
    if (cookie) {
      try {
        const decoded = verify(cookie);
        if (decoded && decoded.jti === jti) {
          clearRefreshCookie(res);
          isCurrent = true;
        }
      } catch (e) {
        // ignore - cookie invalid
      }
    }

    res.json({ message: 'Session revoked', isCurrent });
  } catch (err) {
    console.error('Revoke session error', err);
    res.status(500).json({ message: 'Failed to revoke session' });
  }
});

/**
 * GET /api/auth/events
 * SSE endpoint — subscribes to per-user Redis events and forwards them to the client.
 * Authentication: verifies refresh cookie to determine userId and the subscriber's current jti.
 * Note: EventSource must be able to send cookies (same-origin or appropriate CORS).
 */
router.get('/events', async (req, res) => {
  try {
    // validate refresh cookie for SSE authentication
    const cookie = req.cookies[COOKIE_NAME];
    if (!cookie) {
      return res.status(401).json({ message: 'No refresh cookie' });
    }
    let decoded;
    try {
      decoded = verify(cookie);
    } catch (e) {
      return res.status(401).json({ message: 'Invalid refresh cookie' });
    }
    const userId = decoded.userId;
    const currentJti = decoded.jti || null;
    if (!userId) return res.status(401).json({ message: 'Invalid refresh cookie payload' });

    // set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    // send a ping to keep connection alive
    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'connected' })}\n\n`);

    const subscriber = await createRedisSubscriber();
    const channel = `events:user:${userId}`;

    // subscribe to channel
    const onMessage = (message) => {
      try {
        const payload = JSON.parse(message);
        // compute isCurrent for this subscriber connection by comparing jti to subscriber's cookie jti
        if (payload && payload.type === 'session_revoked') {
          const enriched = { ...payload, isCurrent: payload.jti === currentJti };
          res.write(`data: ${JSON.stringify(enriched)}\n\n`);
        } else if (payload && payload.type === 'all_revoked') {
          // if any of the jtis include currentJti mark isCurrent true
          const isCurrent = Array.isArray(payload.jtis) && payload.jtis.includes(currentJti);
          const enriched = { ...payload, isCurrent };
          res.write(`data: ${JSON.stringify(enriched)}\n\n`);
        } else {
          // forward other events as-is
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
      } catch (e) {
        console.warn('Failed to handle pubsub message', e);
      }
    };

    // The subscribe call blocks until unsubscribed — handle cancellation when connection closes
    const subscribePromise = subscriber.subscribe(channel, onMessage);

    req.on('close', async () => {
      try {
        await subscriber.unsubscribe(channel);
      } catch (e) {
        // ignore
      }
      try {
        // quitting subscriber
        await subscriber.quit();
      } catch (e) {
        // ignore
      }
    });

    // keep the route alive (subscribePromise resolves when unsubscribed)
    await subscribePromise;
  } catch (err) {
    console.error('SSE events error', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to establish event stream' });
  }
});

module.exports = router;