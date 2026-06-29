const express = require('express');
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');
const { sendEmail, templates } = require('../utils/email');
const router = express.Router();
 
router.post('/', contactLimiter, [
  body('name').notEmpty().trim(),
  body('destination').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { name, email, phone, country, destination, budget, message } = req.body;
    const result = await run(
      'INSERT INTO leads (name, email, phone, country, destination, budget, message, source) VALUES (?,?,?,?,?,?,?,?)',
      [name, email||null, phone||null, country||null, destination, budget||null, message||null, 'website']
    );
    if (email) sendEmail({ to: email, subject: '✈️ We received your request!', html: templates.studentConfirm({ name, email, phone, country, destination, budget }), entityType: 'lead', entityId: result.lastInsertRowid });
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@studybridgenetwork.com';
    sendEmail({ to: adminEmail, subject: `🔔 New Lead: ${name} → ${destination}`, html: templates.adminNotif({ name, email, phone, country, destination, budget, message }, 'lead'), entityType: 'lead', entityId: result.lastInsertRowid });
    res.status(201).json({ success: true, message: 'Thank you! We will contact you within 24 hours.', id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, destination, search, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM leads WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (destination) { sql += ' AND destination = ?'; params.push(destination); }
    if (search) { sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; const s = `%${search}%`; params.push(s,s,s); }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page)-1)*parseInt(limit));
    const leads = await all(sql, params);
    const total = (await get('SELECT COUNT(*) as c FROM leads')).c || 0;
    res.json({ success: true, data: leads, total, page: parseInt(page), pages: Math.ceil(total/limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const lead = await get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const notes = await all("SELECT * FROM notes WHERE entity_type='lead' AND entity_id=? ORDER BY id DESC", [req.params.id]);
    res.json({ success: true, data: { ...lead, notes } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, assigned_to } = req.body;
    await run("UPDATE leads SET status=?, assigned_to=?, updated_at=datetime('now') WHERE id=?", [status, assigned_to, req.params.id]);
    res.json({ success: true, message: 'Lead updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.post('/:id/notes', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ success: false, message: 'Note required' });
  try {
    await run("INSERT INTO notes (entity_type, entity_id, content, author) VALUES ('lead',?,?,?)", [req.params.id, content, req.user.name]);
    res.status(201).json({ success: true, message: 'Note added' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await run('DELETE FROM leads WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
module.exports = router;