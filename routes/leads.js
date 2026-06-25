const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');
const { sendEmail, templates } = require('../utils/email');
const router = express.Router();
 
// POST /api/leads — public (form submission)
router.post('/', contactLimiter, [
  body('name').notEmpty().trim(),
  body('destination').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
 
  const { name, email, phone, country, destination, budget, message } = req.body;
  const db = getDB();
 
  const result = db.prepare(`
    INSERT INTO leads (name, email, phone, country, destination, budget, message, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'website')
  `).run(name, email || null, phone || null, country || null, destination, budget || null, message || null);
 
  // Send emails (non-blocking)
  if (email) {
    sendEmail({ to: email, subject: 'We received your request! ✈️', html: templates.studentConfirm({ name, email, phone, country, destination, budget }), entityType: 'lead', entityId: result.lastInsertRowid });
  }
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@studybridgenetwork.com';
  sendEmail({ to: adminEmail, subject: `🔔 New Lead: ${name} → ${destination}`, html: templates.adminNotif({ name, email, phone, country, destination, budget, message }, 'lead'), entityType: 'lead', entityId: result.lastInsertRowid });
 
  res.status(201).json({ success: true, message: 'Thank you! We will contact you within 24 hours.', id: result.lastInsertRowid });
});
 
// GET /api/leads — admin only
router.get('/', authMiddleware, (req, res) => {
  const db = getDB();
  const { status, destination, search, page = 1, limit = 20 } = req.query;
  let query = 'SELECT * FROM leads WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (destination) { query += ' AND destination = ?'; params.push(destination); }
  if (search) { query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const leads = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  res.json({ success: true, data: leads, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});
 
// GET /api/leads/:id
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  const notes = db.prepare("SELECT * FROM notes WHERE entity_type='lead' AND entity_id=? ORDER BY created_at DESC").all(req.params.id);
  res.json({ success: true, data: { ...lead, notes } });
});
 
// PUT /api/leads/:id — update status
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const { status, assigned_to } = req.body;
  db.prepare("UPDATE leads SET status=?, assigned_to=?, updated_at=datetime('now') WHERE id=?").run(status, assigned_to, req.params.id);
  res.json({ success: true, message: 'Lead updated' });
});
 
// POST /api/leads/:id/notes
router.post('/:id/notes', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ success: false, message: 'Note content required' });
  const db = getDB();
  db.prepare("INSERT INTO notes (entity_type, entity_id, content, author) VALUES ('lead', ?, ?, ?)").run(req.params.id, content, req.user.name);
  res.status(201).json({ success: true, message: 'Note added' });
});
 
// DELETE /api/leads/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Lead deleted' });
});
 
module.exports = router;