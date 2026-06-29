const express = require('express');
const { body, validationResult } = require('express-validator');
const { run, all } = require('../db/database');
const { contactLimiter } = require('../middleware/rateLimiter');
const { sendEmail, templates } = require('../utils/email');
const router = express.Router();
 
router.post('/', contactLimiter, [
  body('name').notEmpty().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { name, email, phone, country, destination, budget, message } = req.body;
    const result = await run(
      'INSERT INTO leads (name, email, phone, country, destination, budget, message, source) VALUES (?,?,?,?,?,?,?,?)',
      [name, email||null, phone||null, country||null, destination||null, budget||null, message||null, 'contact_page']
    );
    if (email) sendEmail({ to: email, subject: '✈️ Study Bridge Network — We\'ll be in touch!', html: templates.studentConfirm({ name, email, phone, country, destination, budget }) });
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@studybridgenetwork.com';
    sendEmail({ to: adminEmail, subject: `📩 Contact: ${name}`, html: templates.adminNotif({ name, email, phone, country, destination, budget, message }, 'contact') });
    res.status(201).json({ success: true, message: 'Message received! We will contact you within 24 hours.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.get('/destinations', async (req, res) => {
  try {
    const dests = await all('SELECT * FROM destinations WHERE active = 1 ORDER BY name');
    res.json({ success: true, data: dests });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
router.post('/subscribe', contactLimiter, [body('email').isEmail().normalizeEmail()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { email, name, destination } = req.body;
    await run('INSERT OR IGNORE INTO subscribers (email, name, destination) VALUES (?,?,?)', [email, name||null, destination||null]);
    res.json({ success: true, message: 'Subscribed!' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
 
module.exports = router;