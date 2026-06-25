const express = require('express');
const { getDB } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
 
// GET /api/stats/dashboard
router.get('/dashboard', authMiddleware, (req, res) => {
  try {
    const db = getDB();
 
    const totalLeads   = db.prepare('SELECT COUNT(*) as c FROM leads').get().c || 0;
    const newLeads     = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='new'").get().c || 0;
    const totalApps    = db.prepare('SELECT COUNT(*) as c FROM applications').get().c || 0;
    const approvedApps = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status='approved'").get().c || 0;
    const pendingApps  = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status='pending'").get().c || 0;
    const subscribers  = db.prepare('SELECT COUNT(*) as c FROM subscribers WHERE subscribed=1').get().c || 0;
 
    // Use date() function safely
    const todayLeads = db.prepare("SELECT COUNT(*) as c FROM leads WHERE date(created_at) = date('now')").get().c || 0;
    const weekLeads  = db.prepare("SELECT COUNT(*) as c FROM leads WHERE created_at >= datetime('now', '-7 days')").get().c || 0;
 
    const byDestination = db.prepare(`
      SELECT destination, COUNT(*) as count FROM leads
      WHERE destination IS NOT NULL AND destination != ''
      GROUP BY destination ORDER BY count DESC LIMIT 10
    `).all() || [];
 
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM leads
      GROUP BY status ORDER BY count DESC
    `).all() || [];
 
    const recentLeads = db.prepare(`
      SELECT id, name, email, phone, destination, status, created_at
      FROM leads ORDER BY id DESC LIMIT 5
    `).all() || [];
 
    const monthlyLeads = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
      FROM leads
      WHERE created_at IS NOT NULL
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC LIMIT 6
    `).all() || [];
 
    const byPack = db.prepare(`
      SELECT pack_type, COUNT(*) as count FROM applications
      GROUP BY pack_type
    `).all() || [];
 
    res.json({
      success: true,
      data: {
        overview: { totalLeads, newLeads, totalApps, approvedApps, pendingApps, subscribers, todayLeads, weekLeads },
        byDestination,
        byStatus,
        byPack,
        recentLeads,
        monthlyLeads: monthlyLeads.reverse()
      }
    });
 
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;