'use strict';

const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

async function readDb() {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeDb(data) {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function initDbIfNeeded() {
  const db = await readDb();
  if (db) {
    db.users = db.users || [];
    db.roles = db.roles || [];
    db.menus = db.menus || [];
    await writeDb(db);
    console.log('DB found and initialized.');
    return;
  }

  const adminPassword = bcrypt.hashSync('admin123', 10);
  const adminUser = {
    id: uuidv4(),
    username: 'admin',
    password: adminPassword,
    name: 'Administrator',
    roles: ['admin'],
    dataPermissions: ['*']
  };

  const roles = [
    { name: 'admin', description: 'Full access' },
    { name: 'user', description: 'Normal user' }
  ];

  const menus = [
    { id: 'dashboard', title: 'Dashboard', route: '/dashboard', roles: ['admin', 'user'] },
    { id: 'admin', title: 'Admin Panel', route: '/admin', roles: ['admin'] }
  ];

  const initial = {
    users: [adminUser],
    roles,
    menus
  };

  await writeDb(initial);
  console.log('Created initial DB with admin/admin123');
}

async function getAll() {
  return (await readDb()) || { users: [], roles: [], menus: [] };
}

async function getUsers() {
  const db = await getAll();
  return db.users;
}

async function getUserByUsername(username) {
  const users = await getUsers();
  return users.find((u) => u.username === username) || null;
}

async function getUserById(id) {
  const users = await getUsers();
  return users.find((u) => u.id === id) || null;
}

async function createUser({ username, password, name }) {
  const db = await getAll();
  const exists = db.users.find((u) => u.username === username);
  if (exists) throw new Error('User already exists');
  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    username,
    password: hashed,
    name: name || username,
    roles: ['user'],
    dataPermissions: []
  };
  db.users.push(user);
  await writeDb(db);
  return { ...user, password: undefined };
}

async function getRoles() {
  const db = await getAll();
  return db.roles;
}

async function getMenus() {
  const db = await getAll();
  return db.menus;
}

module.exports = {
  initDbIfNeeded,
  getUserByUsername,
  getUserById,
  createUser,
  getRoles,
  getMenus
};