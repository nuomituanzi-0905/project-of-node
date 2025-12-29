'use strict';

const bcrypt = require('bcryptjs');
const db = require('./db');

async function register({ username, password, name }) {
  return db.createUser({ username, password, name });
}

async function authenticate({ username, password }) {
  const user = await db.getUserByUsername(username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  const { password: _p, ...rest } = user;
  return rest;
}

async function getUserInfo(userId) {
  const user = await db.getUserById(userId);
  if (!user) return null;
  const roles = user.roles || [];
  const menus = (await db.getMenus()).filter((m) => m.roles.some((r) => roles.includes(r)));
  return {
    user: {
      id: user.id,
      username: user.username,
      name: user.name
    },
    roles,
    menus,
    dataPermissions: user.dataPermissions || []
  };
}

module.exports = { register, authenticate, getUserInfo };