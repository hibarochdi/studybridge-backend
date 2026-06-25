// ════════════════════════════════════════════════
//  EMAIL UTILITY — Nodemailer + HTML Templates
// ════════════════════════════════════════════════
const nodemailer = require('nodemailer');
const { getDB }  = require('../db/database');
 
// ── Transporter Setup ─────────────────────────
function createTransporter() {
  // Gmail example — swap for SendGrid/Mailgun in production
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'contact@studybridgenetwork.com',
      pass: process.env.EMAIL_PASS || 'your_app_password_here'
    }
  });
}
 
// ── Base HTML Template ────────────────────────
function baseTemplate(content, subject) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
<style>
  body { margin:0; padding:0; background:#f0f4f8; font-family:'Helvetica Neue',Arial,sans-serif; }
  .wrap { max-width:600px; margin:30px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#0B1F3A; padding:32px 40px; text-align:center; }
  .logo { color:#D4AF37; font-size:22px; font-weight:900; letter-spacing:1px; margin:0; }
  .logo span { color:#ffffff; }
  .tagline { color:rgba(255,255,255,0.5); font-size:12px; margin-top:4px; letter-spacing:2px; }
  .body { padding:40px; }
  .h1 { color:#0B1F3A; font-size:24px; font-weight:700; margin:0 0 16px; }
  .p { color:#4a5568; font-size:15px; line-height:1.75; margin:0 0 14px; }
  .highlight { background:#f7f3e3; border-left:4px solid #D4AF37; padding:16px 20px; border-radius:0 8px 8px 0; margin:20px 0; }
  .highlight p { margin:0; color:#0B1F3A; font-weight:500; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:20px 0; }
  .info-item { background:#f7fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; }
  .info-label { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#718096; margin-bottom:4px; }
  .info-value { font-size:14px; color:#2d3748; font-weight:600; }
  .btn { display:inline-block; background:#D4AF37; color:#0B1F3A; padding:14px 28px; border-radius:50px; text-decoration:none; font-weight:700; font-size:14px; margin:20px 0; }
  .wa-btn { display:inline-block; background:#25D366; color:#ffffff; padding:14px 28px; border-radius:50px; text-decoration:none; font-weight:700; font-size:14px; margin:8px 8px 8px 0; }
  .footer-bar { background:#0B1F3A; padding:24px 40px; text-align:center; }
  .footer-bar p { color:rgba(255,255,255,0.4); font-size:12px; margin:0; }
  .footer-bar a { color:#D4AF37; text-decoration:none; }
  .divider { border:none; border-top:1px solid #e2e8f0; margin:24px 0; }
  .badge { display:inline-block; background:#e8f5e9; color:#2e7d32; font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; letter-spacing:1px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <p class="logo">Study<span>Bridge</span> Network</p>
    <p class="tagline">FROM THE WORLD TO THE WORLD</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer-bar">
    <p>© 2025 Study Bridge Network · <a href="mailto:contact@studybridgenetwork.com">contact@studybridgenetwork.com</a></p>
    <p style="margin-top:6px"><a href="https://wa.me/212600000000">WhatsApp</a> · <a href="https://instagram.com/studybridgenetwork">Instagram</a></p>
  </div>
</div>
</body>
</html>`;
}
 
// ── Template: Confirmation to student ─────────
function studentConfirmTemplate(lead) {
  const content = `
    <h2 class="h1">🎉 We received your request, ${lead.name}!</h2>
    <p class="p">Thank you for reaching out to Study Bridge Network. Your message has been received and one of our advisors will contact you personally within <strong>24 hours</strong>.</p>
    <div class="highlight">
      <p>📍 Your request details:</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      ${lead.destination ? `<tr><td style="padding:8px 0;color:#718096;font-size:13px;width:140px">Destination</td><td style="padding:8px 0;font-weight:600;color:#2d3748">${lead.destination}</td></tr>` : ''}
      ${lead.budget ? `<tr><td style="padding:8px 0;color:#718096;font-size:13px">Budget</td><td style="padding:8px 0;font-weight:600;color:#2d3748">${lead.budget}</td></tr>` : ''}
      ${lead.country ? `<tr><td style="padding:8px 0;color:#718096;font-size:13px">Your country</td><td style="padding:8px 0;font-weight:600;color:#2d3748">${lead.country}</td></tr>` : ''}
    </table>
    <hr class="divider">
    <p class="p">While you wait, you can also reach us directly:</p>
    <a href="https://wa.me/212600000000" class="wa-btn">💬 Message us on WhatsApp</a>
    <hr class="divider">
    <p style="color:#718096;font-size:13px">From the world to the world — we'll help you get there. 🌍</p>
  `;
  return baseTemplate(content, 'We received your request!');
}
 
// ── Template: Admin notification ─────────────
function adminNotifTemplate(lead, type = 'lead') {
  const content = `
    <h2 class="h1">🔔 New ${type === 'application' ? 'Application' : 'Lead'} Received</h2>
    <p class="p">A new ${type} has been submitted on Study Bridge Network. Action required.</p>
    <div class="highlight">
      <p><strong>${lead.name}</strong> — ${lead.destination || 'Destination not specified'}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#718096;font-size:13px;width:140px">Name</td><td style="padding:8px 0;font-weight:600;color:#2d3748">${lead.name}</td></tr>
      ${lead.email ? `<tr><td style="padding:8px 0;color:#718096;font-size:13px">Email</td><td style="padding:8px 0;font-weight:600;color:#2d3748"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>` : ''}
      ${lead.phone ? `<tr><td style="padding:8px 0;color:#718096;font-size:13px">Phone/WhatsApp</td><td style="padding:8px 0;font-weight:600;color:#2d3748"><a href="https://wa.me/${lead.phone.replace(/\D/g,'')}">${lead.phone}</a></td></tr>` : ''}
      ${lead.country ? `<tr><td style="padding:8px 0;color:#718096;font-size:13px">From</td><td style="padding:8px 0;font-weight:600;color:#2d3748">${lead.country}</td></tr>` : ''}
      ${lead.destination ? `<tr><td style="padding:8px 0;color:#718096;font-size:13px">Destination</td><td style="padding:8px 0;font-weight:600;color:#2d3748">${lead.destination}</td></tr>` : ''}
      ${lead.budget ? `<tr><td style="padding:8px 0;color:#718096;font-size:13px">Budget</td><td style="padding:8px 0;font-weight:600;color:#2d3748">${lead.budget}</td></tr>` : ''}
      ${lead.message ? `<tr><td style="padding:8px 0;color:#718096;font-size:13px">Message</td><td style="padding:8px 0;color:#2d3748">${lead.message}</td></tr>` : ''}
    </table>
    <p style="font-size:13px;color:#718096">Submitted: ${new Date().toLocaleString('en-GB')}</p>
  `;
  return baseTemplate(content, `New ${type}: ${lead.name}`);
}
 
// ── Template: Status update to student ────────
function statusUpdateTemplate(name, destination, status, message) {
  const statusColors = {
    pending:     '#f6ad55',
    in_review:   '#4299e1',
    approved:    '#48bb78',
    rejected:    '#fc8181',
    completed:   '#9f7aea'
  };
  const statusLabels = {
    pending:     '⏳ Pending Review',
    in_review:   '🔍 Under Review',
    approved:    '✅ Approved',
    rejected:    '❌ Not Accepted',
    completed:   '🎓 Completed'
  };
  const color = statusColors[status] || '#D4AF37';
  const label = statusLabels[status] || status;
  const content = `
    <h2 class="h1">Update on your application, ${name}</h2>
    <p class="p">We have an update regarding your Study Bridge Network file for <strong>${destination}</strong>.</p>
    <div style="text-align:center;padding:24px;background:#f7fafc;border-radius:12px;margin:20px 0">
      <div style="display:inline-block;background:${color};color:#fff;padding:10px 24px;border-radius:50px;font-weight:700;font-size:16px">${label}</div>
    </div>
    ${message ? `<div class="highlight"><p>${message}</p></div>` : ''}
    <p class="p">If you have any questions, don't hesitate to contact us directly on WhatsApp.</p>
    <a href="https://wa.me/212600000000" class="wa-btn">💬 Contact Us on WhatsApp</a>
  `;
  return baseTemplate(content, `Application Update — ${label}`);
}
 
// ── Send Function ─────────────────────────────
async function sendEmail({ to, subject, html, entityType, entityId }) {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"Study Bridge Network" <${process.env.EMAIL_USER || 'contact@studybridgenetwork.com'}>`,
      to,
      subject,
      html
    });
    // Log to DB
    try {
      const db = getDB();
      db.prepare(`
        INSERT INTO email_logs (to_email, subject, status, entity_type, entity_id)
        VALUES (?, ?, 'sent', ?, ?)
      `).run(to, subject, entityType || null, entityId || null);
    } catch (_) {}
    console.log(`✉️  Email sent to ${to}: ${subject}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
    // Log failure
    try {
      const db = getDB();
      db.prepare(`
        INSERT INTO email_logs (to_email, subject, status, entity_type, entity_id)
        VALUES (?, ?, 'failed', ?, ?)
      `).run(to, subject, entityType || null, entityId || null);
    } catch (_) {}
    return { success: false, error: err.message };
  }
}
 
module.exports = {
  sendEmail,
  templates: {
    studentConfirm: studentConfirmTemplate,
    adminNotif:     adminNotifTemplate,
    statusUpdate:   statusUpdateTemplate
  }
};