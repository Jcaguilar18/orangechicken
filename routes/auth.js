const express  = require('express');
const bcrypt   = require('bcrypt');
const crypto   = require('crypto');
const passport = require('passport');
const { User } = require('../models');
const { sendVerificationCode, sendPasswordResetEmail } = require('../config/mailer');

const router = express.Router();

const googleEnabled   = () => !!(process.env.GOOGLE_CLIENT_ID   && process.env.GOOGLE_CLIENT_SECRET);
const facebookEnabled = () => !!(process.env.FACEBOOK_APP_ID    && process.env.FACEBOOK_APP_SECRET);

function setSession(req, user) {
  req.session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
    isBanned: user.isBanned,
    isRestricted: user.isRestricted,
    avatar: user.avatar,
    bio: user.bio,
  };
}

// ── Login ──────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null, info: null, googleEnabled: googleEnabled(), facebookEnabled: facebookEnabled() });
});

router.post('/login', async (req, res) => {
  const opts = { error: null, info: null, googleEnabled: googleEnabled(), facebookEnabled: facebookEnabled() };
  const { username, password } = req.body;
  try {
    const identifier = username.trim();
    const isEmail = identifier.includes('@');
    const user = await User.findOne({
      where: isEmail ? { email: identifier } : { username: identifier },
    });
    if (!user || !user.password) {
      return res.render('login', { ...opts, error: 'Invalid username / email or password.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { ...opts, error: 'Invalid username / email or password.' });

    if (user.isBanned) {
      return res.render('login', { ...opts, error: 'This account has been suspended. Contact support if you believe this is a mistake.' });
    }

    if (!user.emailVerified) {
      // Resend a fresh code and redirect to verify page
      const code   = String(Math.floor(100000 + Math.random() * 900000));
      const expiry = new Date(Date.now() + 15 * 60 * 1000);
      await user.update({ verificationCode: code, verificationCodeExpiry: expiry });
      try { await sendVerificationCode(user.email, user.username, code); } catch (e) { console.error(e); }
      return res.redirect(`/verify-code?email=${encodeURIComponent(user.email)}`);
    }

    setSession(req, user);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { ...opts, error: 'Something went wrong. Please try again.' });
  }
});

// ── Register ───────────────────────────────────────────────────────
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', { error: null, googleEnabled: googleEnabled(), facebookEnabled: facebookEnabled() });
});

router.post('/register', async (req, res) => {
  const opts = { error: null, googleEnabled: googleEnabled(), facebookEnabled: facebookEnabled() };
  const { username, email, password, confirmPassword } = req.body;
  if (!username || !email || !password) {
    return res.render('register', { ...opts, error: 'All fields are required.' });
  }
  if (password !== confirmPassword) {
    return res.render('register', { ...opts, error: 'Passwords do not match.' });
  }
  if (password.length < 6) {
    return res.render('register', { ...opts, error: 'Password must be at least 6 characters.' });
  }
  try {
    const hashed = await bcrypt.hash(password, 12);
    const code   = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    await User.create({
      username:               username.trim(),
      email:                  email.trim(),
      password:               hashed,
      emailVerified:          false,
      verificationCode:       code,
      verificationCodeExpiry: expiry,
    });
    try { await sendVerificationCode(email.trim(), username.trim(), code); }
    catch (e) { console.error('Verification code email failed:', e.message); }
    res.redirect(`/verify-code?email=${encodeURIComponent(email.trim())}`);
  } catch (err) {
    const isDuplicate = err.name === 'SequelizeUniqueConstraintError';
    res.render('register', {
      ...opts,
      error: isDuplicate ? 'Username or email is already taken.' : 'Registration failed. Try again.',
    });
  }
});

// ── Verify OTP code ───────────────────────────────────────────────
router.get('/verify-code', (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect('/register');
  res.render('verify-code', { email, error: null });
});

router.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.render('verify-code', { email, error: 'Please enter your verification code.' });
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.render('verify-code', { email, error: 'Account not found.' });
    if (user.emailVerified) {
      setSession(req, user);
      return res.redirect('/');
    }
    if (user.verificationCode !== code.trim()) {
      return res.render('verify-code', { email, error: 'Incorrect code. Please try again.' });
    }
    if (user.verificationCodeExpiry < new Date()) {
      return res.render('verify-code', { email, error: 'Code has expired. <a href="/resend-code?email=' + encodeURIComponent(email) + '" style="color:var(--cyan)">Resend code</a>' });
    }
    await user.update({ emailVerified: true, verificationCode: null, verificationCodeExpiry: null });
    setSession(req, user);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('verify-code', { email, error: 'Something went wrong. Please try again.' });
  }
});

router.get('/resend-code', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect('/login');
  try {
    const user = await User.findOne({ where: { email } });
    if (user && !user.emailVerified) {
      const code   = String(Math.floor(100000 + Math.random() * 900000));
      const expiry = new Date(Date.now() + 15 * 60 * 1000);
      await user.update({ verificationCode: code, verificationCodeExpiry: expiry });
      try { await sendVerificationCode(user.email, user.username, code); } catch (e) { console.error(e); }
    }
  } catch (err) { console.error(err); }
  res.render('verify-code', { email, error: null, info: 'A new code has been sent to your email.' });
});

// ── Forgot password ────────────────────────────────────────────────
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { error: null, success: null });
});

router.post('/forgot-password', async (req, res) => {
  const successMsg = "If that email is registered, a reset link has been sent.";
  const { email } = req.body;
  if (!email) return res.render('forgot-password', { error: null, success: successMsg });
  try {
    const user = await User.findOne({ where: { email: email.trim() } });
    if (user && user.password) {
      const token  = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.update({ resetToken: token, resetTokenExpiry: expiry });
      try { await sendPasswordResetEmail(user.email, user.username, token); }
      catch (e) { console.error('Reset email failed:', e.message); }
    }
  } catch (err) { console.error(err); }
  res.render('forgot-password', { error: null, success: successMsg });
});

// ── Reset password ─────────────────────────────────────────────────
router.get('/reset-password', async (req, res) => {
  const { token } = req.query;
  const user = token ? await User.findOne({ where: { resetToken: token } }) : null;
  if (!user || user.resetTokenExpiry < new Date()) {
    return res.render('reset-password', { token: null, error: 'This reset link is invalid or has expired.', success: null });
  }
  res.render('reset-password', { token, error: null, success: null });
});

router.post('/reset-password', async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  if (!token) return res.redirect('/forgot-password');
  const user = await User.findOne({ where: { resetToken: token } });
  if (!user || user.resetTokenExpiry < new Date()) {
    return res.render('reset-password', { token: null, error: 'This reset link is invalid or has expired.', success: null });
  }
  if (!password || password.length < 6) {
    return res.render('reset-password', { token, error: 'Password must be at least 6 characters.', success: null });
  }
  if (password !== confirmPassword) {
    return res.render('reset-password', { token, error: 'Passwords do not match.', success: null });
  }
  const hashed = await bcrypt.hash(password, 12);
  await user.update({ password: hashed, resetToken: null, resetTokenExpiry: null });
  res.render('login', {
    error: null,
    info: 'Password reset successfully. You can now log in.',
    googleEnabled: googleEnabled(),
    facebookEnabled: facebookEnabled(),
  });
});

// ── Logout ─────────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Google OAuth ───────────────────────────────────────────────────
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    setSession(req, req.user);
    res.redirect('/');
  }
);

// ── Facebook OAuth ─────────────────────────────────────────────────
router.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    setSession(req, req.user);
    res.redirect('/');
  }
);

module.exports = router;
