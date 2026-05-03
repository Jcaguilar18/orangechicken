const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_MLA  = ['Jan.','Feb.','Mar.','Apr.','May','June','July','Aug.','Sept.','Oct.','Nov.','Dec.'];

function resolveMonth(raw, fmt) {
  if (!raw) return '';
  const n = parseInt(raw, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return fmt === 'mla' ? MONTHS_MLA[n - 1] : MONTHS_FULL[n - 1];
  const idx = MONTHS_FULL.findIndex(m => m.toLowerCase().startsWith((raw + '').toLowerCase().substring(0, 3)));
  if (idx >= 0) return fmt === 'mla' ? MONTHS_MLA[idx] : MONTHS_FULL[idx];
  return raw;
}

function initials(name) {
  if (!name) return '';
  return name.trim().split(/\s+/).map(n => n.charAt(0).toUpperCase() + '.').join(' ');
}

function formatAuthors(authors, style) {
  if (!authors || !authors.length) return '';
  if (style === 'apa') {
    const fmt = a => {
      const last = a.last || a.first || '';
      const first = a.last ? a.first : '';
      return last + (first ? ', ' + initials(first) : '');
    };
    if (authors.length === 1) return fmt(authors[0]);
    if (authors.length <= 20) {
      const all = authors.map(fmt);
      return all.slice(0, -1).join(', ') + ', & ' + all[all.length - 1];
    }
    return authors.slice(0, 19).map(fmt).join(', ') + ', . . . ' + fmt(authors[authors.length - 1]);
  }
  if (style === 'mla') {
    const fmtFirst = a => (a.last ? a.last + ', ' + a.first : a.first || '').trim();
    const fmtOther = a => ((a.first || '') + ' ' + (a.last || '')).trim();
    if (authors.length === 1) return fmtFirst(authors[0]);
    if (authors.length === 2) return fmtFirst(authors[0]) + ', and ' + fmtOther(authors[1]);
    return fmtFirst(authors[0]) + ', et al.';
  }
  if (style === 'chicago') {
    const fmtFirst = a => (a.last ? a.last + ', ' + a.first : a.first || '').trim();
    const fmtOther = a => ((a.first || '') + ' ' + (a.last || '')).trim();
    if (authors.length === 1) return fmtFirst(authors[0]);
    if (authors.length === 2) return fmtFirst(authors[0]) + ' and ' + fmtOther(authors[1]);
    if (authors.length === 3) return fmtFirst(authors[0]) + ', ' + fmtOther(authors[1]) + ', and ' + fmtOther(authors[2]);
    return fmtFirst(authors[0]) + ' et al.';
  }
  if (style === 'harvard') {
    const fmt = a => {
      const last = a.last || a.first || '';
      const first = a.last ? a.first : '';
      return last + (first ? ', ' + initials(first) : '');
    };
    if (authors.length === 1) return fmt(authors[0]);
    if (authors.length <= 3) return authors.map(fmt).join(' and ');
    return fmt(authors[0]) + ' et al.';
  }
  return '';
}

function buildInText(authors, creatorName, year, dYear, pageNum, style) {
  const pg     = pageNum ? ', p. ' + pageNum : '';
  const pgMla  = pageNum ? ' ' + pageNum : '';
  const y      = year || dYear || 'n.d.';
  const src    = (authors && authors.length) ? authors : creatorName ? [{ first: creatorName, last: '' }] : [];
  if (!src.length) {
    if (style === 'mla')     return `(${pgMla.trim() || 'n.p.'})`;
    return `(n.d.${pg})`;
  }
  const first = src[0];
  const last  = first.last || first.first || 'Unknown';
  if (style === 'apa')     return src.length >= 3 ? `(${last} et al., ${y}${pg})` : `(${last}, ${y}${pg})`;
  if (style === 'mla')     return src.length >= 3 ? `(${last} et al.${pgMla})` : `(${last}${pgMla})`;
  if (style === 'chicago') return src.length >= 3 ? `(${last} et al. ${y}${pg})` : `(${last} ${y}${pg})`;
  if (style === 'harvard') return src.length >= 3 ? `(${last} et al., ${y}${pg})` : `(${last}, ${y}${pg})`;
  return '';
}

function generate(params) {
  const { style, type, authors, creator, year, dYear, dMonth, dDay,
          title, subtitle, edition, publisher, place, journalName,
          volume, issue, pages, magPages, siteName, platform,
          institution, reportType, doi, pageNum, aDay, aMonth, aYear } = params;

  const s = style, t = type;
  const au = formatAuthors(authors, s);
  const fullTitle = subtitle ? title + ': ' + subtitle : title;

  let full = '';

  if (s === 'apa') {
    const auStr  = au || (t === 'video' ? creator : '');
    const edStr  = edition ? ` (${edition} ed.)` : '';
    const doiStr = doi ? `\n${doi}` : '';
    const mFull  = resolveMonth(dMonth, 'apa');
    const dateStr = dYear ? (mFull ? `${dYear}, ${mFull}${dDay ? ' ' + dDay : ''}` : dYear) : 'n.d.';
    const y = year || dYear || 'n.d.';

    if (t === 'book')    full = `${auStr}${auStr ? ' ' : ''}(${y}). *${fullTitle}*${edStr}. ${publisher}.${doiStr}`;
    else if (t === 'journal') {
      const volStr   = volume ? `, *${volume}*` : '';
      const issueStr = issue  ? `(${issue})` : '';
      const pgStr    = pages  ? `, ${pages}` : '';
      full = `${auStr}${auStr ? ' ' : ''}(${y}). ${title}.${journalName ? ' *' + journalName + '*' : ''}${volStr}${issueStr}${pgStr}. ${doiStr || 'https://doi.org/xxxxx'}`;
    }
    else if (t === 'website') full = `${auStr}${auStr ? ' ' : ''}(${dateStr}). *${title}*. ${siteName}.${doi ? '\n' + doi : ''}`;
    else if (t === 'magazine') {
      const pgStr = magPages ? `, ${magPages}` : '';
      full = `${auStr}${auStr ? ' ' : ''}(${dateStr}). ${title}. *${publisher}*${pgStr}.${doi ? '\n' + doi : ''}`;
    }
    else if (t === 'video') full = `${creator} [${creator}]. (${dateStr}). *${title}* [Video]. ${platform}.${doi ? '\n' + doi : ''}`;
    else if (t === 'report') {
      const typeStr = reportType ? ` [${reportType}${institution ? ', ' + institution : ''}]` : (institution ? ` [${institution}]` : '');
      full = `${auStr}${auStr ? ' ' : ''}(${y}). *${fullTitle}*${typeStr}.${doiStr}`;
    }
  }

  if (s === 'mla') {
    const mMla    = resolveMonth(dMonth, 'mla');
    const dateStr = [dDay, mMla, dYear].filter(Boolean).join(' ');

    if (t === 'book') {
      const edStr = edition ? `, ${edition} ed.` : '';
      full = `${au}${au ? '. ' : ''}*${fullTitle}*. ${publisher}, ${year || dYear || 'n.d.'}${edStr}.`;
    }
    else if (t === 'journal') {
      const parts = [journalName ? `*${journalName}*` : '', volume ? `vol. ${volume}` : '', issue ? `no. ${issue}` : '', year || dYear, pages ? `pp. ${pages}` : ''].filter(Boolean).join(', ');
      full = `${au}${au ? '. ' : ''}"${title}." ${parts}${doi ? ',\n' + doi : ''}.`;
    }
    else if (t === 'website') {
      const accessed = aDay && aMonth && aYear ? ` Accessed ${aDay} ${resolveMonth(aMonth,'mla')} ${aYear}.` : '';
      full = `${au}${au ? '. ' : ''}"${title}." *${siteName}*, ${dateStr},${doi ? '\n' + doi + '.' : '.'}${accessed}`;
    }
    else if (t === 'magazine') {
      full = `${au}${au ? '. ' : ''}"${title}." *${publisher}*, ${dateStr}${magPages ? ', pp. ' + magPages : ''}.${doi ? '\n' + doi : ''}`;
    }
    else if (t === 'video') full = `"${title}." *${platform || 'YouTube'}*, uploaded by ${creator}, ${dateStr}, ${doi}.`;
    else if (t === 'report') {
      full = `${au}${au ? '. ' : ''}*${fullTitle}*.${reportType ? ' ' + reportType + ',' : ''} ${institution}, ${year || dYear || 'n.d.'}.${doi ? '\n' + doi : ''}`;
    }
  }

  if (s === 'chicago') {
    const mFull   = resolveMonth(dMonth, 'chicago');
    const dateStr = dYear ? (mFull ? `${mFull}${dDay ? ' ' + dDay : ''}, ${dYear}` : dYear) : 'n.d.';
    const y = year || dYear || 'n.d.';

    if (t === 'book') {
      const edStr = edition ? `, ${edition} ed.` : '';
      full = `${au}${au ? '. ' : ''}*${fullTitle}*${edStr}. ${place ? place + ': ' : ''}${publisher}, ${y}.`;
    }
    else if (t === 'journal') {
      const pgStr = pages ? `: ${pages}` : '';
      full = `${au}${au ? '. ' : ''}"${title}." *${journalName}* ${volume || ''}${issue ? ', no. ' + issue : ''} (${y})${pgStr}.${doi ? '\n' + doi : ''}`;
    }
    else if (t === 'website') full = `${au}${au ? '. ' : ''}"${title}." *${siteName}*. ${dateStr}. ${doi || 'URL'}.`;
    else if (t === 'magazine') {
      full = `${au}${au ? '. ' : ''}"${title}." *${publisher}*, ${dateStr}${magPages ? ', ' + magPages : ''}.${doi ? '\n' + doi : ''}`;
    }
    else if (t === 'video') full = `${creator}. "${title}." ${platform || 'YouTube'} video, ${dateStr}. ${doi}.`;
    else if (t === 'report') {
      full = `${au}${au ? '. ' : ''}*${fullTitle}*${reportType ? '. ' + reportType : ''}. ${institution}, ${y}.${doi ? '\n' + doi : ''}`;
    }
  }

  if (s === 'harvard') {
    const mFull   = resolveMonth(dMonth, 'harvard');
    const dateStr = dYear ? (mFull ? `${dYear}, ${mFull}${dDay ? ' ' + dDay : ''}` : dYear) : 'n.d.';
    const accessed = aDay && aMonth && aYear ? ` (Accessed: ${aDay} ${resolveMonth(aMonth,'harvard')} ${aYear}).` : '';
    const y = year || dYear || 'n.d.';

    if (t === 'book') {
      const edStr = edition ? ` ${edition} edn.` : '';
      full = `${au}${au ? ' ' : ''}(${y}) *${fullTitle}*.${edStr} ${place ? place + ': ' : ''}${publisher}.`;
    }
    else if (t === 'journal') {
      full = `${au}${au ? ' ' : ''}(${y}) '${title}', *${journalName}*${volume ? ', vol. ' + volume : ''}${issue ? ', no. ' + issue : ''}${pages ? ', pp. ' + pages : ''}.${doi ? '\nDOI: ' + doi : ''}`;
    }
    else if (t === 'website') full = `${au}${au ? ' ' : ''}(${dateStr}) *${title}*. Available at: ${doi || 'URL'}${accessed}`;
    else if (t === 'magazine') {
      full = `${au}${au ? ' ' : ''}(${dateStr}) '${title}', *${publisher}*${magPages ? ', pp. ' + magPages : ''}.${doi ? '\n' + doi : ''}`;
    }
    else if (t === 'video') full = `${creator} (${dateStr}) *${title}* [Video online]. Available at: ${doi || 'URL'}${accessed}`;
    else if (t === 'report') {
      full = `${au}${au ? ' ' : ''}(${y}) *${fullTitle}*${reportType ? ' (' + reportType + ')' : ''}. ${institution}.${doi ? '\nAvailable at: ' + doi : ''}`;
    }
  }

  full = full.replace(/\s{2,}/g, ' ').trim();
  const inText = buildInText(authors, creator, year, dYear, pageNum, s);
  return { full, inText };
}

module.exports = { generate };
