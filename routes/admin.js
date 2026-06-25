const express = require('express');
const { getDB } = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const router = express.Router();
 
// All admin routes require auth
router.use(authMiddleware, adminOnly);
 
// GET /api/admin/users
router.get('/users', (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, name, email, role, created_at, last_login FROM users ORDER BY created_at DESC').all();
  res.json({ success: true, data: users });
});
 
// GET /api/admin/subscribers
router.get('/subscribers', (req, res) => {
  const db = getDB();
  const subs = db.prepare('SELECT * FROM subscribers WHERE subscribed=1 ORDER BY created_at DESC').all();
  res.json({ success: true, data: subs, total: subs.length });
});
 
// GET /api/admin/email-logs
router.get('/email-logs', (req, res) => {
  const db = getDB();
  const logs = db.prepare('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 100').all();
  res.json({ success: true, data: logs });
});
 
// POST /api/admin/broadcast — send newsletter to all subscribers
router.post('/broadcast', async (req, res) => {
  const { subject, html } = req.body;
  if (!subject || !html) return res.status(400).json({ success: false, message: 'subject and html required' });
  const db = getDB();
  const subs = db.prepare('SELECT email FROM subscribers WHERE subscribed=1').all();
  let sent = 0;
  for (const sub of subs) {
    const result = await sendEmail({ to: sub.email, subject, html });
    if (result.success) sent++;
  }
  res.json({ success: true, message: `Broadcast sent to ${sent}/${subs.length} subscribers` });
});
 
// GET /api/admin/destinations
router.get('/destinations', (req, res) => {
  const db = getDB();
  const dests = db.prepare('SELECT * FROM destinations ORDER BY name').all();
  res.json({ success: true, data: dests });
});
 
// PUT /api/admin/destinations/:id
router.put('/destinations/:id', (req, res) => {
  const db = getDB();
  const { name, cost_min, cost_max, language, scholarship, visa_level, programs, advantages, active } = req.body;
  db.prepare(`UPDATE destinations SET name=?,cost_min=?,cost_max=?,language=?,scholarship=?,visa_level=?,programs=?,advantages=?,active=? WHERE id=?`)
    .run(name, cost_min, cost_max, language, scholarship, visa_level, programs, advantages, active ? 1 : 0, req.params.id);
  res.json({ success: true, message: 'Destination updated' });
});
 
// DELETE /api/admin/subscribers/:id
router.delete('/subscribers/:id', (req, res) => {
  const db = getDB();
  db.prepare('UPDATE subscribers SET subscribed=0 WHERE id=?').run(req.params.id);
  res.json({ success: true, message: 'Unsubscribed' });
});
 
module.exports = router;