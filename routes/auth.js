const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db/database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
 
const router = express.Router();
 
// POST /api/auth/login
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
 
  const { email, password } = req.body;
  const db   = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
 
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
 
  // Fix: use JS date string instead of SQLite now
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now, user.id);
 
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
 
  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});
 
// POST /api/auth/register (superadmin only)
router.post('/register', authMiddleware, [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 })
], (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'SuperAdmin only' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
 
  const { name, email, password, role = 'admin' } = req.body;
  const db = getDB();
 
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ success: false, message: 'Email already exists' });
 
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(name, email, hash, role);
 
  res.status(201).json({ success: true, message: 'User created', id: result.lastInsertRowid });
});
 
// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});
 
// PUT /api/auth/password
router.put('/password', authMiddleware, [
  body('current').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
 
  const db   = getDB();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
 
  if (!bcrypt.compareSync(req.body.current, user.password)) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }
 
  const hash = bcrypt.hashSync(req.body.newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true, message: 'Password updated successfully' });
});
 
module.exports = router;