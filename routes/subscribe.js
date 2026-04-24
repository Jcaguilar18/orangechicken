const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { Subscription, User, SiteSetting } = require('../models');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const paypal = require('../utils/paypal');

const router = express.Router();

const settingsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads/settings')),
  filename:    (req, file, cb) => cb(null, 'gcash-qr' + path.extname(file.originalname)),
});
const settingsUpload = multer({
  storage: settingsStorage,
  fileFilter: (req, file, cb) => {
    if (['image/jpeg','image/png','image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Image files only.'));
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

async function getPaymentSettings() {
  const [qrImage, gcashNum, paypalEmail, paypalMe] = await Promise.all([
    SiteSetting.findOne({ where: { key: 'gcash_qr_image' } }),
    SiteSetting.findOne({ where: { key: 'gcash_number' } }),
    SiteSetting.findOne({ where: { key: 'paypal_email' } }),
    SiteSetting.findOne({ where: { key: 'paypal_me' } }),
  ]);
  return {
    qrImage:     qrImage?.value    || null,
    gcashNum:    gcashNum?.value   || null,
    paypalEmail: paypalEmail?.value || null,
    paypalMe:    paypalMe?.value   || null,
  };
}

// Subscribe page
router.get('/subscribe', requireAuth, async (req, res) => {
  const today    = new Date().toISOString().slice(0, 10);
  const existing = await Subscription.findOne({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']],
  });
  const isActive = existing && existing.status === 'active' && existing.endDate >= today;
  const settings = await getPaymentSettings();
  res.render('subscribe', { subscription: existing, isActive, ...settings, success: null, error: null });
});

router.post('/subscribe', requireAuth, async (req, res) => {
  const today    = new Date().toISOString().slice(0, 10);
  const settings = await getPaymentSettings();

  const method = req.body.paymentMethod === 'paypal' ? 'paypal' : 'gcash';
  const ref    = method === 'paypal'
    ? (req.body.paypalRef || '').trim()
    : (req.body.gcashRef  || '').trim();

  const renderErr = async (error) => {
    const existing = await Subscription.findOne({ where: { userId: req.session.user.id }, order: [['createdAt','DESC']] });
    const isActive = existing && existing.status === 'active' && existing.endDate >= today;
    res.render('subscribe', { subscription: existing, isActive, ...settings, success: null, error });
  };

  if (!ref) return renderErr(
    method === 'paypal'
      ? 'Please enter your PayPal transaction ID.'
      : 'Please enter your GCash reference number.'
  );

  const existing = await Subscription.findOne({
    where: { userId: req.session.user.id, status: 'pending' },
  });
  if (existing) return renderErr('You already have a pending subscription request. Please wait for admin approval.');

  try {
    const newSub = await Subscription.create({
      userId:        req.session.user.id,
      gcashRef:      ref,
      paymentMethod: method,
      status:        'pending',
    });
    res.render('subscribe', {
      subscription: newSub,
      isActive: false,
      ...settings,
      success: 'Subscription request submitted! Admin will approve within 24 hours.',
      error: null,
    });
  } catch (err) {
    console.error(err);
    const existing2 = await Subscription.findOne({ where: { userId: req.session.user.id }, order: [['createdAt','DESC']] });
    res.render('subscribe', { subscription: existing2, isActive: false, ...settings, success: null, error: 'Failed to submit. Please try again.' });
  }
});

// Admin: list subscriptions
router.get('/admin/subscriptions', requireAdmin, async (req, res) => {
  const subs = await Subscription.findAll({
    include: [{ model: User, as: 'subscriber', attributes: ['username', 'email'] }],
    order: [['createdAt', 'DESC']],
  });
  res.render('admin-subscriptions', { subs });
});

// Admin: approve
router.post('/admin/subscriptions/:id/approve', requireAdmin, async (req, res) => {
  try {
    const sub = await Subscription.findByPk(req.params.id);
    if (sub) {
      const today = new Date().toISOString().slice(0, 10);
      const end   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await sub.update({ status: 'active', startDate: today, endDate: end, approvedBy: req.session.user.id });
    }
  } catch (err) { console.error(err); }
  res.redirect('/admin/subscriptions');
});

// Admin: revoke
router.post('/admin/subscriptions/:id/revoke', requireAdmin, async (req, res) => {
  try {
    const sub = await Subscription.findByPk(req.params.id);
    if (sub) await sub.update({ status: 'expired' });
  } catch (err) { console.error(err); }
  res.redirect('/admin/subscriptions');
});

// Admin: site settings
router.get('/admin/settings', requireAdmin, async (req, res) => {
  const settings = await getPaymentSettings();
  res.render('admin-settings', { ...settings, success: null, error: null });
});

router.post('/admin/settings', requireAdmin, settingsUpload.single('gcashQr'), async (req, res) => {
  const { gcashNumber, paypalEmail, paypalMe } = req.body;
  let success = null, error = null;
  try {
    if (req.file)
      await SiteSetting.update({ value: req.file.filename }, { where: { key: 'gcash_qr_image' } });
    if (gcashNumber !== undefined)
      await SiteSetting.update({ value: gcashNumber.trim() || null }, { where: { key: 'gcash_number' } });
    if (paypalEmail !== undefined)
      await SiteSetting.update({ value: paypalEmail.trim() || null }, { where: { key: 'paypal_email' } });
    if (paypalMe !== undefined)
      await SiteSetting.update({ value: paypalMe.trim().replace(/^https?:\/\/paypal\.me\//i, '') || null }, { where: { key: 'paypal_me' } });
    success = 'Settings saved successfully.';
  } catch (err) {
    console.error(err);
    error = 'Failed to save settings.';
  }
  const settings = await getPaymentSettings();
  res.render('admin-settings', { ...settings, success, error });
});

// ─── PayPal automated payment endpoints ──────────────────────────────────────

// Returns the client ID + plan ID the frontend needs to render PayPal buttons
router.get('/subscribe/paypal/config', requireAuth, async (req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID) return res.json({ ok: false, error: 'PayPal not configured.' });
  try {
    const planId = await paypal.ensureMonthlyPlan();
    res.json({ ok: true, clientId: process.env.PAYPAL_CLIENT_ID, planId, mode: process.env.PAYPAL_MODE || 'sandbox' });
  } catch (err) {
    console.error('PayPal config error:', err.message);
    res.json({ ok: false, error: 'Failed to load PayPal config.' });
  }
});

// Creates a monthly subscription server-side and returns the subscription ID
router.post('/subscribe/paypal/create-subscription-server', requireAuth, async (req, res) => {
  try {
    const planId = await paypal.ensureMonthlyPlan();
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const sub = await paypal.createSubscription(
      planId,
      baseUrl + '/subscribe?success=1',
      baseUrl + '/subscribe?cancelled=1'
    );
    res.json({ ok: true, subscriptionId: sub.id });
  } catch (err) {
    console.error('PayPal create subscription server error:', err.message);
    res.json({ ok: false, error: 'Failed to create subscription.' });
  }
});

// Called by frontend after user approves a monthly subscription
router.post('/subscribe/paypal/activate-subscription', requireAuth, async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) return res.json({ ok: false, error: 'Missing subscription ID.' });

  try {
    const sub = await paypal.getSubscription(subscriptionId);
    if (sub.status !== 'ACTIVE') return res.json({ ok: false, error: 'Subscription not active yet.' });

    const today = new Date().toISOString().slice(0, 10);
    const end   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Cancel any existing pending subscription for this user
    await Subscription.destroy({ where: { userId: req.session.user.id, status: 'pending' } });

    await Subscription.create({
      userId:        req.session.user.id,
      gcashRef:      subscriptionId,
      paymentMethod: 'paypal',
      plan:          'monthly',
      status:        'active',
      startDate:     today,
      endDate:       end,
      approvedBy:    null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('PayPal activate subscription error:', err.message);
    res.json({ ok: false, error: 'Failed to activate subscription.' });
  }
});

// Called by frontend to create a one-time $5 lifetime order
router.post('/subscribe/paypal/create-order', requireAuth, async (req, res) => {
  try {
    const order = await paypal.createOrder('5.00');
    res.json({ ok: true, id: order.id });
  } catch (err) {
    console.error('PayPal create order error:', err.message);
    res.json({ ok: false, error: 'Failed to create PayPal order.' });
  }
});

// Called by frontend after user approves the lifetime order
router.post('/subscribe/paypal/capture-order', requireAuth, async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.json({ ok: false, error: 'Missing order ID.' });

  try {
    const capture = await paypal.captureOrder(orderId);
    if (capture.status !== 'COMPLETED') return res.json({ ok: false, error: 'Payment not completed.' });

    const today = new Date().toISOString().slice(0, 10);

    await Subscription.destroy({ where: { userId: req.session.user.id, status: 'pending' } });

    await Subscription.create({
      userId:        req.session.user.id,
      gcashRef:      orderId,
      paymentMethod: 'paypal',
      plan:          'lifetime',
      status:        'active',
      startDate:     today,
      endDate:       '2099-12-31',
      approvedBy:    null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('PayPal capture order error:', err.message);
    res.json({ ok: false, error: 'Failed to capture payment.' });
  }
});

module.exports = router;
