'use strict';

const { createClient } = require('redis');

let redisClient = null;

async function createRedisClient() {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  redisClient = createClient({ url });
  redisClient.on('error', (err) => console.error('Redis error', err));
  await redisClient.connect();
  console.log('Connected to Redis at', url);
  return redisClient;
}

function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call createRedisClient() first.');
  }
  return redisClient;
}

async function createRedisSubscriber() {
  const client = getRedisClient();
  const sub = client.duplicate();
  sub.on('error', (err) => console.error('Redis subscriber error', err));
  await sub.connect();
  return sub;
}

module.exports = { createRedisClient, getRedisClient, createRedisSubscriber };