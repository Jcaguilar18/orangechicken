const { getFlags } = require('../lib/featureFlags');

function featureGuard(featureName) {
  return async (req, res, next) => {
    if (req.session?.user?.isAdmin) return next();

    const flags = res.locals.featureFlags || await getFlags();
    const flag  = flags[featureName] || { mode: 'all', blocked: [] };

    if (flag.mode === 'disabled') {
      return res.status(503).render('feature-disabled', { pageTitle: 'Feature Unavailable', reason: 'disabled' });
    }
    if (flag.mode === 'logged_in' && !req.session?.user) {
      return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    }
    if (flag.mode === 'blocked' && req.session?.user) {
      const ids = (flag.blocked || []).map(Number);
      if (ids.includes(Number(req.session.user.id))) {
        return res.status(403).render('feature-disabled', { pageTitle: 'Access Restricted', reason: 'blocked' });
      }
    }

    next();
  };
}

module.exports = { featureGuard };
