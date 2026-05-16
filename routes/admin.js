const express = require('express');
const bcrypt = require('bcrypt');
const { User, Article, Comment, SiteSetting } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const { invalidateCache, FEATURES, DEFAULT_FLAGS } = require('../lib/featureFlags');

const router = express.Router();

// Helper: load all users with stats
async function loadUsers() {
  const users = await User.findAll({
    attributes: ['id', 'username', 'email', 'isAdmin', 'isBanned', 'isRestricted', 'isProVIP', 'avatar', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });
  return Promise.all(
    users.map(async (u) => {
      const articleCount = await Article.count({ where: { userId: u.id } });
      const commentCount = await Comment.count({ where: { userId: u.id } });
      return { ...u.toJSON(), articleCount, commentCount };
    })
  );
}

// Admin panel
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const [freeModeSetting, limitSetting, flagRow, users] = await Promise.all([
      SiteSetting.findOne({ where: { key: 'tools_free_mode' } }),
      SiteSetting.findOne({ where: { key: 'tools_daily_limit' } }),
      SiteSetting.findOne({ where: { key: 'feature_flags' } }),
      loadUsers(),
    ]);
    res.render('admin', {
      users,
      success: req.query.success || null,
      error: req.query.error || null,
      toolsFreeMode: freeModeSetting?.value === '1',
      toolsDailyLimit: Math.max(1, parseInt(limitSetting?.value || '3', 10) || 3),
    });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Tools settings
router.post('/admin/tools-settings', requireAdmin, async (req, res) => {
  const freeMode = req.body.freeMode === '1' ? '1' : '0';
  const limit = Math.max(1, parseInt(req.body.dailyLimit, 10) || 3);
  try {
    await SiteSetting.upsert({ key: 'tools_free_mode', value: freeMode });
    await SiteSetting.upsert({ key: 'tools_daily_limit', value: String(limit) });
    res.redirect('/admin?success=Tools+settings+updated.');
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+save+tools+settings.');
  }
});

// Change password
router.post('/admin/users/:id/password', requireAdmin, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.render('admin', { users: await loadUsers(), success: null, error: 'Password must be at least 6 characters.' });
  }
  try {
    const hashed = await bcrypt.hash(newPassword, 12);
    await User.update({ password: hashed }, { where: { id: req.params.id } });
    res.redirect('/admin?success=Password+updated+successfully.');
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+update+password.');
  }
});

// Ban user
router.post('/admin/users/:id/ban', requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.session.user.id) {
    return res.redirect('/admin?error=You+cannot+ban+yourself.');
  }
  try {
    const user = await User.findByPk(targetId);
    if (!user) return res.redirect('/admin');
    if (user.isAdmin) return res.redirect('/admin?error=Cannot+ban+an+admin+account.');
    await user.update({ isBanned: true });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + ' has been banned.')}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+ban+user.');
  }
});

// Unban user
router.post('/admin/users/:id/unban', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.redirect('/admin');
    await user.update({ isBanned: false });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + ' has been unbanned.')}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+unban+user.');
  }
});

// Restrict user (can log in but cannot post or comment)
router.post('/admin/users/:id/restrict', requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.session.user.id) {
    return res.redirect('/admin?error=You+cannot+restrict+yourself.');
  }
  try {
    const user = await User.findByPk(targetId);
    if (!user) return res.redirect('/admin');
    await user.update({ isRestricted: true });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + ' has been restricted.')}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+restrict+user.');
  }
});

// Unrestrict user
router.post('/admin/users/:id/unrestrict', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.redirect('/admin');
    await user.update({ isRestricted: false });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + "'s restriction has been lifted.")}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+lift+restriction.');
  }
});

// Grant Pro VIP
router.post('/admin/users/:id/provip', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.redirect('/admin');
    await user.update({ isProVIP: true });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + ' has been granted Pro VIP.')}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+grant+Pro+VIP.');
  }
});

// Revoke Pro VIP
router.post('/admin/users/:id/unprovip', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.redirect('/admin');
    await user.update({ isProVIP: false });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + "'s Pro VIP has been revoked.")}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+revoke+Pro+VIP.');
  }
});

// Delete user account
router.post('/admin/users/:id/delete', requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.session.user.id) {
    return res.redirect('/admin?error=You+cannot+delete+your+own+account.');
  }
  try {
    const user = await User.findByPk(targetId);
    if (!user) return res.redirect('/admin');
    if (user.isAdmin) return res.redirect('/admin?error=Cannot+delete+an+admin+account.');
    const username = user.username;
    await Article.destroy({ where: { userId: targetId } });
    await Comment.destroy({ where: { userId: targetId } });
    await user.destroy();
    res.redirect(`/admin?success=${encodeURIComponent('"' + username + '" has been permanently deleted.')}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+delete+account.');
  }
});

// ── Exclusive Access (quick setting from main admin page) ─────────────────────
router.post('/admin/exclusive-access', requireAdmin, async (req, res) => {
  const allowed = ['all', 'logged_in', 'subscribers', 'provip', 'disabled'];
  const mode = allowed.includes(req.body.mode) ? req.body.mode : 'all';
  try {
    const flagRow = await SiteSetting.findOne({ where: { key: 'feature_flags' } });
    let flags = {};
    for (const f of FEATURES) flags[f] = { ...DEFAULT_FLAGS[f] };
    if (flagRow?.value) {
      const parsed = JSON.parse(flagRow.value);
      for (const f of FEATURES) if (parsed[f]) flags[f] = { ...flags[f], ...parsed[f] };
    }
    flags.exclusive = { mode, blocked: flags.exclusive?.blocked || [] };
    await SiteSetting.upsert({ key: 'feature_flags', value: JSON.stringify(flags) });
    invalidateCache();
    res.redirect('/admin?success=Exclusive+access+updated.');
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+update+exclusive+access.');
  }
});

// ── Feature Visibility ────────────────────────────────────────────────────────
router.get('/admin/features', requireAdmin, async (req, res) => {
  try {
    const [flagRow, users] = await Promise.all([
      SiteSetting.findOne({ where: { key: 'feature_flags' } }),
      User.findAll({ where: { isAdmin: false }, attributes: ['id', 'username'], order: [['username', 'ASC']] }),
    ]);
    let flags = {};
    for (const f of FEATURES) flags[f] = { ...DEFAULT_FLAGS[f] };
    if (flagRow?.value) {
      const parsed = JSON.parse(flagRow.value);
      for (const f of FEATURES) {
        if (parsed[f]) flags[f] = { ...flags[f], ...parsed[f] };
      }
    }
    res.render('admin-features', { flags, users, success: req.query.success || null, error: req.query.error || null });
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+load+feature+settings.');
  }
});

router.post('/admin/features', requireAdmin, async (req, res) => {
  try {
    const flags = {};
    for (const feat of FEATURES) {
      const mode    = req.body[`${feat}_mode`] || 'all';
      const rawIds  = req.body[`${feat}_blocked`];
      const blocked = rawIds ? [].concat(rawIds).map(Number).filter(Boolean) : [];
      flags[feat] = { mode, blocked };
    }
    await SiteSetting.upsert({ key: 'feature_flags', value: JSON.stringify(flags) });
    invalidateCache();
    res.redirect('/admin/features?success=Feature+visibility+saved.');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/features?error=Failed+to+save.');
  }
});

// ── Popup Announcement ────────────────────────────────────────────
router.get('/admin/popup', requireAdmin, async (req, res) => {
  const row = await SiteSetting.findOne({ where: { key: 'popup_announcement' } });
  const popup = row ? JSON.parse(row.value) : { enabled: false, title: '', message: '' };
  res.render('admin-popup', { popup, success: req.query.success || null, error: req.query.error || null });
});

router.post('/admin/popup', requireAdmin, async (req, res) => {
  try {
    const popup = {
      enabled: req.body.enabled === '1',
      title:   (req.body.title   || '').trim().slice(0, 100),
      message: (req.body.message || '').trim().slice(0, 500),
    };
    await SiteSetting.upsert({ key: 'popup_announcement', value: JSON.stringify(popup) });
    res.redirect('/admin/popup?success=Popup+saved.');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/popup?error=Failed+to+save.');
  }
});

module.exports = router;
