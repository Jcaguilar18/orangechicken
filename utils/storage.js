const { execFile } = require('child_process');
const { promisify } = require('util');
const fs   = require('fs');
const path = require('path');

const execFileAsync = promisify(execFile);

const TMP_DIR       = '/tmp/uploads';
const MIN_FREE_MB   = 500;   // reject new jobs if free disk drops below this
const MAX_TMP_MB    = 2048;  // reject new jobs if /tmp/uploads total exceeds this
const STALE_HOURS   = 2;     // sweep files/dirs older than this on every cleanup tick

async function getFreeSpaceMB() {
  try {
    const { stdout } = await execFileAsync('df', ['--output=avail', '-BM', TMP_DIR]);
    return parseInt(stdout.trim().split('\n')[1]) || Infinity;
  } catch (_) { return Infinity; }
}

async function getTmpUsageMB() {
  try {
    const { stdout } = await execFileAsync('du', ['-sm', TMP_DIR]);
    return parseInt(stdout.split('\t')[0]) || 0;
  } catch (_) { return 0; }
}

async function checkSpace() {
  try {
    const [freeMB, usedMB] = await Promise.all([getFreeSpaceMB(), getTmpUsageMB()]);
    if (freeMB < MIN_FREE_MB)
      return { ok: false, error: `Server storage is low (${freeMB} MB free). Try again later.` };
    if (usedMB > MAX_TMP_MB)
      return { ok: false, error: `Temporary storage is full (${usedMB} MB used). Try again in a few minutes.` };
    return { ok: true };
  } catch (_) {
    return { ok: true }; // don't block on check failure
  }
}

// Delete anything in /tmp/uploads older than STALE_HOURS (catches crashes, leaked tmpdirs, etc.)
function cleanStale() {
  if (!fs.existsSync(TMP_DIR)) return;
  const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000;
  try {
    for (const entry of fs.readdirSync(TMP_DIR)) {
      const full = path.join(TMP_DIR, entry);
      try {
        if (fs.statSync(full).mtimeMs < cutoff)
          fs.rmSync(full, { recursive: true, force: true });
      } catch (_) {}
    }
  } catch (_) {}
}

module.exports = { checkSpace, cleanStale };
