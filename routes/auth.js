const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { run, get } = require('../db/database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const router = express.Router();
 
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { email, password } = req.body;
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    await run('UPDATE users SET last_login = ? WHERE id = ?', [new Date().toISOString(), user.id]);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.post('/register', authMiddleware, [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 })
], async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ success: false, message: 'SuperAdmin only' });
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { name, email, password, role = 'admin' } = req.body;
    const exists = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (exists) return res.status(409).json({ success: false, message: 'Email already exists' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hash, role]);
    res.status(201).json({ success: true, message: 'User created', id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});
 
router.put('/password', authMiddleware, [
  body('current').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(req.body.current, user.password))
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    const hash = bcrypt.hashSync(req.body.newPassword, 10);
    await run('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ success: true, message: 'Password updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
module.exports = router;