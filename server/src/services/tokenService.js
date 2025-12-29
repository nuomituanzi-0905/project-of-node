'use strict';

const { v4: uuidv4 } = require('uuid');
const { signAccess, signRefresh, verify } = require('../config/jwt');
const { getRedisClient } = require('../config/redis');

const ACCESS_TTL = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || process.env.TOKEN_TTL_SECONDS || '3600', 10);
const REFRESH_TTL = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || `${7 * 24 * 3600}`, 10);
const REFRESH_MAX = parseInt(process.env.REFRESH_TOKEN_MAX_PER_USER || '5', 10);

/**
 * Redis schema:
 * - Access tokens:
 *   key: token:<accessToken> -> userId (EX = ACCESS_TTL)
 *
 * - Refresh tokens:
 *   key: refresh:<jti> -> JSON.stringify({ userId, createdAt, ip, userAgent }) (EX = REFRESH_TTL)
 *   sorted set: refreshs:user:<userId> -> zadd with score = createdAt (timestamp ms)
 *
 * Events:
 * - Publish to channel: events:user:<userId> with JSON payloads describing revocations, etc.
 */

async function createAccessToken(userId) {
  const payload = { userId };
  const token = signAccess(payload);
  const redis = getRedisClient();
  const key = `token:${token}`;
  await redis.set(key, userId, { EX: ACCESS_TTL });
  return token;
}

async function revokeAccessToken(accessToken) {
  if (!accessToken) return;
  const redis = getRedisClient();
  const key = `token:${accessToken}`;
  await redis.del(key);
}

/**
 * meta: { ip, userAgent }
 */
async function createRefreshToken(userId, meta = {}) {
  const jti = uuidv4();
  const createdAt = Date.now();
  const redis = getRedisClient();
  const refreshKey = `refresh:${jti}`;
  const userSetKey = `refreshs:user:${userId}`;

  const payload = {
    userId,
    createdAt,
    ip: meta.ip || null,
    userAgent: meta.userAgent || null
  };

  await redis.set(refreshKey, JSON.stringify(payload), { EX: REFRESH_TTL });
  await redis.zAdd(userSetKey, { score: createdAt, value: jti });

  // enforce max tokens per user: evict oldest if necessary
  const size = await redis.zCard(userSetKey);
  if (size > REFRESH_MAX) {
    const removeCount = size - REFRESH_MAX;
    const toRemove = await redis.zRange(userSetKey, 0, removeCount - 1);
    if (toRemove && toRemove.length > 0) {
      const pipeline = redis.multi();
      for (const oldJti of toRemove) {
        pipeline.del(`refresh:${oldJti}`);
        pipeline.zRem(userSetKey, oldJti);
        pipeline.publish(`events:user:${userId}`, JSON.stringify({ type: 'session_revoked', jti: oldJti }));
      }
      await pipeline.exec();
    }
  }

  const token = signRefresh({ userId, jti });
  return { token, jti, createdAt, meta: payload };
}

async function revokeRefreshTokenByJti(jti) {
  if (!jti) return false;
  const redis = getRedisClient();
  const refreshKey = `refresh:${jti}`;
  const raw = await redis.get(refreshKey);
  if (!raw) {
    return false;
  }
  let meta;
  try {
    meta = JSON.parse(raw);
  } catch (e) {
    meta = null;
  }
  if (meta && meta.userId) {
    const userSetKey = `refreshs:user:${meta.userId}`;
    await redis.zRem(userSetKey, jti);
    await redis.del(refreshKey);
    await redis.publish(`events:user:${meta.userId}`, JSON.stringify({ type: 'session_revoked', jti }));
    return true;
  } else {
    await redis.del(refreshKey);
    return false;
  }
}

async function revokeAllRefreshTokensForUser(userId) {
  if (!userId) return;
  const redis = getRedisClient();
  const userSetKey = `refreshs:user:${userId}`;
  const jtis = await redis.zRange(userSetKey, 0, -1);
  if (jtis && jtis.length > 0) {
    const pipeline = redis.multi();
    for (const jti of jtis) {
      pipeline.del(`refresh:${jti}`);
    }
    pipeline.del(userSetKey);
    await pipeline.exec();
    await redis.publish(`events:user:${userId}`, JSON.stringify({ type: 'all_revoked', jtis }));
  } else {
    await redis.del(userSetKey);
    await redis.publish(`events:user:${userId}`, JSON.stringify({ type: 'all_revoked', jtis: [] }));
  }
}

async function rotateRefreshToken(oldRefreshToken) {
  try {
    const decoded = verify(oldRefreshToken);
    const { userId, jti } = decoded;
    if (!userId || !jti) throw new Error('Invalid refresh token payload');

    const redis = getRedisClient();
    const refreshKey = `refresh:${jti}`;
    const raw = await redis.get(refreshKey);
    if (!raw) {
      try {
        if (userId) await revokeAllRefreshTokensForUser(userId);
      } catch (e) {
        console.warn('Failed to revoke all refresh tokens after detection', e);
      }
      throw new Error('Refresh token not found or already used');
    }

    let meta;
    try {
      meta = JSON.parse(raw);
    } catch (e) {
      meta = null;
    }

    await revokeRefreshTokenByJti(jti);
    const { token: newRefreshToken } = await createRefreshToken(userId, { ip: meta?.ip, userAgent: meta?.userAgent });
    const newAccessToken = await createAccessToken(userId);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (err) {
    throw err;
  }
}

async function validateAccessToken(accessToken) {
  if (!accessToken) throw new Error('No access token provided');
  const payload = verify(accessToken);
  const redis = getRedisClient();
  const key = `token:${accessToken}`;
  const userId = await redis.get(key);
  if (!userId) throw new Error('Access token not found / logged out');
  if (payload.userId !== userId) throw new Error('Token user mismatch');
  return payload;
}

async function listRefreshTokensForUser(userId) {
  const redis = getRedisClient();
  const userSetKey = `refreshs:user:${userId}`;
  const arr = await redis.zRange(userSetKey, 0, -1, { WITHSCORES: true });
  const result = [];
  for (let i = 0; i < arr.length; i += 2) {
    const jti = arr[i];
    const createdAt = parseInt(arr[i + 1], 10);
    const refreshRaw = await redis.get(`refresh:${jti}`);
    let meta = null;
    try {
      meta = refreshRaw ? JSON.parse(refreshRaw) : null;
    } catch (e) {
      meta = null;
    }
    const expiresAt = createdAt + REFRESH_TTL * 1000;
    result.push({
      jti,
      createdAt,
      expiresAt,
      ip: meta?.ip || null,
      userAgent: meta?.userAgent || null
    });
  }
  return result;
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  revokeAccessToken,
  revokeRefreshTokenByJti,
  revokeAllRefreshTokensForUser,
  rotateRefreshToken,
  validateAccessToken,
  listRefreshTokensForUser
};