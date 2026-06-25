// ════════════════════════════════════════════════
//  MIDDLEWARE — JWT Authentication
// ════════════════════════════════════════════════
const jwt    = require('jsonwebtoken');
const { getDB } = require('../db/database');
 
const JWT_SECRET = process.env.JWT_SECRET || 'studybridge_secret_change_in_production_2025';
 
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db   = getDB();
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
 
function adminOnly(req, res, next) {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}
 
module.exports = { authMiddleware, adminOnly, JWT_SECRET };