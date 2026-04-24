const axios = require('axios');

function base() {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

// Cached access token
let _cache = { token: null, exp: 0 };

async function getToken() {
  if (_cache.token && Date.now() < _cache.exp) return _cache.token;
  const res = await axios.post(
    `${base()}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  _cache = { token: res.data.access_token, exp: Date.now() + (res.data.expires_in - 60) * 1000 };
  return _cache.token;
}

function authHeaders() {
  return getToken().then(t => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }));
}

// ── Monthly subscription plan ─────────────────────────────────────────────────
// Creates a product + plan once, caches the plan ID in SiteSettings
async function ensureMonthlyPlan() {
  const { SiteSetting } = require('../models');
  const row = await SiteSetting.findOne({ where: { key: 'paypal_plan_id' } });
  if (row?.value) return row.value;

  const headers = await authHeaders();

  // 1. Create product
  const product = await axios.post(`${base()}/v1/catalogs/products`, {
    name: "JC's Space PRO",
    type: 'SERVICE',
    category: 'SOFTWARE',
  }, { headers });

  // 2. Create plan
  const plan = await axios.post(`${base()}/v1/billing/plans`, {
    product_id: product.data.id,
    name: "PRO Monthly — $1/mo",
    status: 'ACTIVE',
    billing_cycles: [{
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      frequency: { interval_unit: 'MONTH', interval_count: 1 },
      pricing_scheme: { fixed_price: { value: '1.00', currency_code: 'USD' } },
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3,
    },
  }, { headers });

  const planId = plan.data.id;
  await SiteSetting.upsert({ key: 'paypal_plan_id', value: planId });
  return planId;
}

// ── Subscriptions ─────────────────────────────────────────────────────────────
async function createSubscription(planId, returnUrl, cancelUrl) {
  const headers = await authHeaders();
  const res = await axios.post(`${base()}/v1/billing/subscriptions`, {
    plan_id: planId,
    application_context: {
      return_url:          returnUrl,
      cancel_url:          cancelUrl,
      shipping_preference: 'NO_SHIPPING',
      user_action:         'SUBSCRIBE_NOW',
    },
  }, { headers });
  return res.data; // .id is the subscription ID (I-xxxx)
}

async function getSubscription(subscriptionId) {
  const headers = await authHeaders();
  const res = await axios.get(`${base()}/v1/billing/subscriptions/${subscriptionId}`, { headers });
  return res.data;
}

// ── One-time orders ───────────────────────────────────────────────────────────
async function createOrder(amount) {
  const headers = await authHeaders();
  const res = await axios.post(`${base()}/v2/checkout/orders`, {
    intent: 'CAPTURE',
    purchase_units: [{ amount: { currency_code: 'USD', value: amount } }],
  }, { headers });
  return res.data;
}

async function captureOrder(orderId) {
  const headers = await authHeaders();
  const res = await axios.post(`${base()}/v2/checkout/orders/${orderId}/capture`, {}, { headers });
  return res.data;
}

module.exports = { ensureMonthlyPlan, createSubscription, getSubscription, createOrder, captureOrder };
