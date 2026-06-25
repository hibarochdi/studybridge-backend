require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
 
const { initDB }         = require('./db/database');
const authRoutes         = require('./routes/auth');
const leadsRoutes        = require('./routes/leads');
const contactRoutes      = require('./routes/contact');
const applicationsRoutes = require('./routes/applications');
const adminRoutes        = require('./routes/admin');
const statsRoutes        = require('./routes/stats');
 
const app  = express();
const PORT = process.env.PORT || 5000;
 
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
 
// Serve admin dashboard & static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
 
// Admin dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
 
// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', app: 'Study Bridge Network API', version: '1.0.0', time: new Date() });
});
 
// API Routes
app.use('/api/auth',         authRoutes);
app.use('/api/leads',        leadsRoutes);
app.use('/api/contact',      contactRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/stats',        statsRoutes);
 
// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
 
// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});
 
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Study Bridge Network API → http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard          → http://localhost:${PORT}/admin`);
    console.log(`📡 API Health               → http://localhost:${PORT}/api/health\n`);
    console.log(`🔐 Default login: admin@studybridgenetwork.com / Admin@2025!\n`);
  });
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });
 
module.exports = app;