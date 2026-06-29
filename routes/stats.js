const express = require('express');
const { get, all } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
 
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const totalLeads   = ((await get('SELECT COUNT(*) as c FROM leads')) || {}).c || 0;
    const newLeads     = ((await get("SELECT COUNT(*) as c FROM leads WHERE status='new'")) || {}).c || 0;
    const totalApps    = ((await get('SELECT COUNT(*) as c FROM applications')) || {}).c || 0;
    const approvedApps = ((await get("SELECT COUNT(*) as c FROM applications WHERE status='approved'")) || {}).c || 0;
    const pendingApps  = ((await get("SELECT COUNT(*) as c FROM applications WHERE status='pending'")) || {}).c || 0;
    const subscribers  = ((await get('SELECT COUNT(*) as c FROM subscribers WHERE subscribed=1')) || {}).c || 0;
    const todayLeads   = ((await get("SELECT COUNT(*) as c FROM leads WHERE date(created_at)=date('now')")) || {}).c || 0;
    const weekLeads    = ((await get("SELECT COUNT(*) as c FROM leads WHERE created_at >= datetime('now','-7 days')")) || {}).c || 0;
 
    const byDestination = await all("SELECT destination, COUNT(*) as count FROM leads WHERE destination IS NOT NULL AND destination != '' GROUP BY destination ORDER BY count DESC LIMIT 10");
    const byStatus      = await all("SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC");
    const byPack        = await all("SELECT pack_type, COUNT(*) as count FROM applications GROUP BY pack_type");
    const recentLeads   = await all("SELECT id, name, email, phone, destination, status, created_at FROM leads ORDER BY id DESC LIMIT 5");
    const monthlyLeads  = await all("SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM leads WHERE created_at IS NOT NULL GROUP BY strftime('%Y-%m', created_at) ORDER BY month DESC LIMIT 6");
 
    res.json({
      success: true,
      data: {
        overview: { totalLeads, newLeads, totalApps, approvedApps, pendingApps, subscribers, todayLeads, weekLeads },
        byDestination, byStatus, byPack, recentLeads,
        monthlyLeads: monthlyLeads.reverse()
      }
    });
  } catch (e) {
    console.error('Stats error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});
 
module.exports = router;