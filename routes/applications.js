const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');
const { sendEmail, templates } = require('../utils/email');
const router = express.Router();
 
// POST /api/applications — full application
router.post('/', contactLimiter, [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('destination').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
 
  const { name, email, phone, nationality, date_of_birth, destination, field_of_study, level, target_year, budget, scholarship, pack_type, notes } = req.body;
  const db = getDB();
 
  // Create a lead first
  const leadResult = db.prepare(`
    INSERT INTO leads (name, email, phone, country, destination, budget, source, status)
    VALUES (?, ?, ?, ?, ?, ?, 'application', 'new')
  `).run(name, email, phone || null, nationality || null, destination, budget || null);
 
  const appResult = db.prepare(`
    INSERT INTO applications (lead_id, name, email, phone, nationality, date_of_birth, destination, field_of_study, level, target_year, budget, scholarship, pack_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(leadResult.lastInsertRowid, name, email, phone || null, nationality || null, date_of_birth || null, destination, field_of_study || null, level || null, target_year || null, budget || null, scholarship ? 1 : 0, pack_type || 'basic', notes || null);
 
  // Emails
  sendEmail({ to: email, subject: '✈️ Application Received — Study Bridge Network', html: templates.studentConfirm({ name, email, phone, country: nationality, destination, budget }), entityType: 'application', entityId: appResult.lastInsertRowid });
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@studybridgenetwork.com';
  sendEmail({ to: adminEmail, subject: `📋 New Application: ${name} → ${destination}`, html: templates.adminNotif({ name, email, phone, country: nationality, destination, budget, message: `Pack: ${pack_type} | Field: ${field_of_study} | Level: ${level}` }, 'application'), entityType: 'application', entityId: appResult.lastInsertRowid });
 
  res.status(201).json({ success: true, message: 'Application submitted! We will contact you within 24 hours.', id: appResult.lastInsertRowid });
});
 
// GET /api/applications — admin
router.get('/', authMiddleware, (req, res) => {
  const db = getDB();
  const { status, destination, pack_type, page = 1, limit = 20 } = req.query;
  let query = 'SELECT * FROM applications WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (destination) { query += ' AND destination = ?'; params.push(destination); }
  if (pack_type) { query += ' AND pack_type = ?'; params.push(pack_type); }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const apps = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM applications').get().c;
  res.json({ success: true, data: apps, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});
 
// GET /api/applications/:id
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
  const notes = db.prepare("SELECT * FROM notes WHERE entity_type='application' AND entity_id=? ORDER BY created_at DESC").all(req.params.id);
  res.json({ success: true, data: { ...app, notes } });
});
 
// PUT /api/applications/:id — update status + notify student
router.put('/:id', authMiddleware, async (req, res) => {
  const db = getDB();
  const { status, stage, priority, notes_internal } = req.body;
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ success: false, message: 'Not found' });
 
  db.prepare("UPDATE applications SET status=?, stage=?, priority=?, updated_at=datetime('now') WHERE id=?").run(status || app.status, stage || app.stage, priority || app.priority, req.params.id);
 
  // Add internal note if provided
  if (notes_internal) {
    db.prepare("INSERT INTO notes (entity_type, entity_id, content, author) VALUES ('application', ?, ?, ?)").run(req.params.id, notes_internal, req.user.name);
  }
 
  // Notify student on status change
  if (status && status !== app.status && app.email) {
    await sendEmail({ to: app.email, subject: '📋 Update on your Study Bridge application', html: templates.statusUpdate(app.name, app.destination, status, req.body.student_message || null), entityType: 'application', entityId: app.id });
  }
 
  res.json({ success: true, message: 'Application updated' });
});
 
// POST /api/applications/:id/notes
router.post('/:id/notes', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ success: false, message: 'Note required' });
  const db = getDB();
  db.prepare("INSERT INTO notes (entity_type, entity_id, content, author) VALUES ('application', ?, ?, ?)").run(req.params.id, content, req.user.name);
  res.status(201).json({ success: true, message: 'Note added' });
});
 
// DELETE /api/applications/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Application deleted' });
});
 
module.exports = router;