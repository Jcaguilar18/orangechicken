const { getFlags } = require('../lib/featureFlags');

function featureGuard(featureName, { api = false } = {}) {
  return async (req, res, next) => {
    if (req.session?.user?.isAdmin) return next();

    const flags = res.locals.featureFlags || await getFlags();
    const flag  = flags[featureName] || { mode: 'all', blocked: [] };

    const deny = (status, reason, pageTitle) => {
      if (api) return res.status(status).json({ error: reason });
      if (status === 401) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
      return res.status(status).render('feature-disabled', { pageTitle, reason });
    };

    if (flag.mode === 'disabled') {
      return deny(503, 'disabled', 'Feature Unavailable');
    }
    if (flag.mode === 'logged_in' && !req.session?.user) {
      return deny(401, 'Login required.', 'Login Required');
    }
    if (flag.mode === 'subscribers') {
      if (!req.session?.user) return deny(401, 'Login required.', 'Login Required');
      const isSub = res.locals.isSubscriber || req.session.user.isProVIP;
      if (!isSub) return deny(403, 'Pro subscription required.', 'Pro Required');
    }
    if (flag.mode === 'provip') {
      if (!req.session?.user) return deny(401, 'Login required.', 'Login Required');
      if (!req.session.user.isProVIP) return deny(403, 'Pro VIP required.', 'Pro VIP Required');
    }
    if (flag.mode === 'blocked' && req.session?.user) {
      const ids = (flag.blocked || []).map(Number);
      if (ids.includes(Number(req.session.user.id))) {
        return deny(403, 'Access restricted.', 'Access Restricted');
      }
    }

    next();
  };
}

module.exports = { featureGuard };
