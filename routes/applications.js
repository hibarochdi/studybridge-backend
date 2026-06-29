const express = require('express');
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');
const { sendEmail, templates } = require('../utils/email');
const router = express.Router();
 
router.post('/', contactLimiter, [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('destination').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { name, email, phone, nationality, date_of_birth, destination, field_of_study, level, target_year, budget, scholarship, pack_type, notes } = req.body;
    const leadResult = await run('INSERT INTO leads (name, email, phone, country, destination, budget, source, status) VALUES (?,?,?,?,?,?,?,?)',
      [name, email, phone||null, nationality||null, destination, budget||null, 'application', 'new']);
    const appResult = await run(
      'INSERT INTO applications (lead_id,name,email,phone,nationality,date_of_birth,destination,field_of_study,level,target_year,budget,scholarship,pack_type,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [leadResult.lastInsertRowid, name, email, phone||null, nationality||null, date_of_birth||null, destination, field_of_study||null, level||null, target_year||null, budget||null, scholarship?1:0, pack_type||'basic', notes||null]
    );
    sendEmail({ to: email, subject: '✈️ Application Received — Study Bridge Network', html: templates.studentConfirm({ name, email, phone, country: nationality, destination, budget }), entityType: 'application', entityId: appResult.lastInsertRowid });
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@studybridgenetwork.com';
    sendEmail({ to: adminEmail, subject: `📋 New Application: ${name} → ${destination}`, html: templates.adminNotif({ name, email, phone, country: nationality, destination, budget, message: `Pack: ${pack_type} | Field: ${field_of_study}` }, 'application') });
    res.status(201).json({ success: true, message: 'Application submitted!', id: appResult.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, destination, pack_type, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM applications WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (destination) { sql += ' AND destination = ?'; params.push(destination); }
    if (pack_type) { sql += ' AND pack_type = ?'; params.push(pack_type); }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page)-1)*parseInt(limit));
    const apps = await all(sql, params);
    const total = (await get('SELECT COUNT(*) as c FROM applications')).c || 0;
    res.json({ success: true, data: apps, total, page: parseInt(page), pages: Math.ceil(total/limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const app = await get('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ success: false, message: 'Not found' });
    const notes = await all("SELECT * FROM notes WHERE entity_type='application' AND entity_id=? ORDER BY id DESC", [req.params.id]);
    res.json({ success: true, data: { ...app, notes } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, stage, priority, notes_internal, student_message } = req.body;
    const app = await get('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ success: false, message: 'Not found' });
    await run("UPDATE applications SET status=?, stage=?, priority=?, updated_at=datetime('now') WHERE id=?",
      [status||app.status, stage||app.stage, priority||app.priority, req.params.id]);
    if (notes_internal) await run("INSERT INTO notes (entity_type,entity_id,content,author) VALUES ('application',?,?,?)", [req.params.id, notes_internal, req.user.name]);
    if (status && status !== app.status && app.email) {
      sendEmail({ to: app.email, subject: '📋 Update on your Study Bridge application', html: templates.statusUpdate(app.name, app.destination, status, student_message||null) });
    }
    res.json({ success: true, message: 'Updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.post('/:id/notes', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ success: false, message: 'Note required' });
  try {
    await run("INSERT INTO notes (entity_type,entity_id,content,author) VALUES ('application',?,?,?)", [req.params.id, content, req.user.name]);
    res.status(201).json({ success: true, message: 'Note added' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await run('DELETE FROM applications WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
module.exports = router;