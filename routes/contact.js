const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');
const { sendEmail, templates } = require('../utils/email');
const router = express.Router();
 
// POST /api/contact — WhatsApp DM / quick contact
router.post('/', contactLimiter, [
  body('name').notEmpty().trim(),
  body('email').optional().isEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
 
  const { name, email, phone, country, destination, budget, message } = req.body;
  const db = getDB();
 
  const result = db.prepare(`
    INSERT INTO leads (name, email, phone, country, destination, budget, message, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'contact_page')
  `).run(name, email || null, phone || null, country || null, destination || null, budget || null, message || null);
 
  if (email) {
    sendEmail({ to: email, subject: '✈️ Study Bridge Network — We\'ll be in touch!', html: templates.studentConfirm({ name, email, phone, country, destination, budget }), entityType: 'lead', entityId: result.lastInsertRowid });
  }
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@studybridgenetwork.com';
  sendEmail({ to: adminEmail, subject: `📩 Contact Form: ${name}`, html: templates.adminNotif({ name, email, phone, country, destination, budget, message }, 'contact'), entityType: 'lead', entityId: result.lastInsertRowid });
 
  res.status(201).json({ success: true, message: 'Message received! We will contact you within 24 hours.' });
});
 
// GET /api/contact/destinations — public
router.get('/destinations', (req, res) => {
  const db = getDB();
  const dests = db.prepare('SELECT * FROM destinations WHERE active = 1 ORDER BY name').all();
  res.json({ success: true, data: dests });
});
 
// POST /api/contact/subscribe — newsletter
router.post('/subscribe', contactLimiter, [
  body('email').isEmail().normalizeEmail()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
 
  const { email, name, destination } = req.body;
  const db = getDB();
  try {
    db.prepare('INSERT OR IGNORE INTO subscribers (email, name, destination) VALUES (?, ?, ?)').run(email, name || null, destination || null);
    res.json({ success: true, message: 'Subscribed successfully!' });
  } catch (_) {
    res.json({ success: true, message: 'Already subscribed.' });
  }
});
 
module.exports = router;