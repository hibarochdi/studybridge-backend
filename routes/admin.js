const express = require('express');
const { run, get, all } = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const router = express.Router();
 
router.use(authMiddleware, adminOnly);
 
router.get('/users', async (req, res) => {
  try {
    const users = await all('SELECT id, name, email, role, created_at, last_login FROM users ORDER BY id DESC');
    res.json({ success: true, data: users });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.get('/subscribers', async (req, res) => {
  try {
    const subs = await all('SELECT * FROM subscribers WHERE subscribed=1 ORDER BY id DESC');
    res.json({ success: true, data: subs, total: subs.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.delete('/subscribers/:id', async (req, res) => {
  try {
    await run('UPDATE subscribers SET subscribed=0 WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Unsubscribed' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.get('/email-logs', async (req, res) => {
  try {
    const logs = await all('SELECT * FROM email_logs ORDER BY id DESC LIMIT 100');
    res.json({ success: true, data: logs });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.post('/broadcast', async (req, res) => {
  const { subject, html } = req.body;
  if (!subject || !html) return res.status(400).json({ success: false, message: 'subject and html required' });
  try {
    const subs = await all('SELECT email FROM subscribers WHERE subscribed=1');
    let sent = 0;
    for (const sub of subs) { const r = await sendEmail({ to: sub.email, subject, html }); if (r.success) sent++; }
    res.json({ success: true, message: `Sent to ${sent}/${subs.length} subscribers` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.get('/destinations', async (req, res) => {
  try {
    const dests = await all('SELECT * FROM destinations ORDER BY name');
    res.json({ success: true, data: dests });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.put('/destinations/:id', async (req, res) => {
  try {
    const { name, cost_min, cost_max, language, scholarship, visa_level, programs, advantages, active } = req.body;
    await run('UPDATE destinations SET name=?,cost_min=?,cost_max=?,language=?,scholarship=?,visa_level=?,programs=?,advantages=?,active=? WHERE id=?',
      [name, cost_min, cost_max, language, scholarship, visa_level, programs, advantages, active?1:0, req.params.id]);
    res.json({ success: true, message: 'Updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
module.exports = router;