const FEATURES = ['tools', 'shows', 'exclusive', 'scraper', 'contact'];
const DEFAULT_FLAGS = Object.fromEntries(
  FEATURES.map(f => [f, { mode: 'all', blocked: [] }])
);

let _cache    = null;
let _cacheAge = 0;
const TTL = 30_000;

async function getFlags() {
  if (_cache && Date.now() - _cacheAge < TTL) return _cache;
  try {
    const { SiteSetting } = require('../models');
    const row = await SiteSetting.findOne({ where: { key: 'feature_flags' } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      _cache = {};
      for (const f of FEATURES) {
        _cache[f] = { ...DEFAULT_FLAGS[f], ...(parsed[f] || {}) };
      }
    } else {
      _cache = { ...DEFAULT_FLAGS };
    }
  } catch {
    _cache = { ...DEFAULT_FLAGS };
  }
  _cacheAge = Date.now();
  return _cache;
}

function invalidateCache() {
  _cache    = null;
  _cacheAge = 0;
}

module.exports = { getFlags, invalidateCache, FEATURES, DEFAULT_FLAGS };
