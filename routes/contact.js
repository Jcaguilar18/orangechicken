const express    = require('express');
const { ContactMessage } = require('../models');
const { requireAdmin }   = require('../middleware/auth');
const { transporter }    = require('../config/mailer');

const router = express.Router();

// Public: contact form
router.get('/contact', (req, res) => {
  res.render('contact', { success: null, error: null, formData: {} });
});

router.post('/contact', async (req, res) => {
  const { name, email, subject, type, message, budget } = req.body;
  if (!name || !email || !subject || !type || !message) {
    return res.render('contact', {
      error: 'All fields except budget are required.',
      success: null,
      formData: req.body,
    });
  }

  // Save to DB first
  let saved;
  try {
    saved = await ContactMessage.create({
      name:    name.trim(),
      email:   email.trim(),
      subject: subject.trim(),
      type,
      message: message.trim(),
      budget:  budget?.trim() || null,
    });
  } catch (err) {
    console.error('DB save failed:', err);
    return res.render('contact', { error: 'Failed to send. Please try again.', success: null, formData: req.body });
  }

  // Send email (non-blocking failure)
  try {
    const budgetLine = budget ? `<tr><td><b>Budget:</b></td><td>${budget}</td></tr>` : '';
    await transporter.sendMail({
      from:    process.env.GMAIL_USER,
      to:      process.env.GMAIL_USER,
      subject: `[Jc's Space] ${type}: ${subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#00d4ff">New message on Jc's Space</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>From:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${name} &lt;${email}&gt;</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Type:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${type}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Subject:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${subject}</td></tr>
            ${budgetLine}
            <tr><td colspan="2" style="padding:8px"><b>Message:</b><br/><br/>${message.replace(/\n/g,'<br/>')}</td></tr>
          </table>
          <p style="color:#888;font-size:12px;margin-top:24px">Sent via Jc's Space contact form</p>
        </div>
      `,
    });
  } catch (mailErr) {
    console.error('Email send failed (message still saved):', mailErr.message);
  }

  res.render('contact', { success: 'Your message has been transmitted! I\'ll get back to you soon.', error: null, formData: {} });
});

// Admin: view messages
router.get('/admin/messages', requireAdmin, async (req, res) => {
  try {
    const messages = await ContactMessage.findAll({ order: [['createdAt', 'DESC']] });
    res.render('admin-messages', { messages });
  } catch (err) {
    console.error(err);
    res.render('admin-messages', { messages: [] });
  }
});

// Admin: toggle read
router.post('/admin/messages/:id/read', requireAdmin, async (req, res) => {
  try {
    const msg = await ContactMessage.findByPk(req.params.id);
    if (msg) await msg.update({ read: !msg.read });
  } catch (err) { console.error(err); }
  res.redirect('/admin/messages');
});

// Admin: delete
router.post('/admin/messages/:id/delete', requireAdmin, async (req, res) => {
  try {
    await ContactMessage.destroy({ where: { id: req.params.id } });
  } catch (err) { console.error(err); }
  res.redirect('/admin/messages');
});

module.exports = router;
