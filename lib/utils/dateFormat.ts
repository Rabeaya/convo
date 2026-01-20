/**
 * Date Formatting Utilities
 * 
 * Matches AngularJS dateAgo filter and localize filter
 * Formats dates as "18h", "2d", "Sep 16, 2024", etc.
 */

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MILLI_SECS_IN_DAY = 24 * 60 * 60 * 1000;

function normalizeAndGetUnixTimestamp(ts: unknown): number {
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    // If seconds, convert to ms (Angular backend generally sends ms, but we harden)
    if (ts > 0 && ts < 1e12) return ts * 1000;
    return ts;
  }

  if (typeof ts === 'string') {
    const tmp = parseInt(ts, 10);
    // Angular: if tmp_ts == ts -> numeric string
    if (String(tmp) === ts) {
      if (tmp > 0 && tmp < 1e12) return tmp * 1000;
      return tmp;
    }
    // Angular: new Date(ts.replace(' ', 'T') + 'Z').getTime()
    const d = new Date(ts.replace(' ', 'T') + 'Z');
    const t = d.getTime();
    return Number.isFinite(t) ? t : Date.now();
  }

  // Date object, etc.
  const d = new Date(ts as any);
  const t = d.getTime();
  return Number.isFinite(t) ? t : Date.now();
}

function formatAngularDate(ts: number, fmt: string): string {
  const d = new Date(ts);

  // Only implement the formats Angular uses in feed/comments.
  // - "MMM d"
  // - "MMM d, yyyy"
  // - "shortDate" (used in feed search)
  if (fmt === 'MMM d') {
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }
  if (fmt === 'MMM d, yyyy') {
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  if (fmt === 'shortDate') {
    // Angular dateFilter('shortDate') is locale-based; Convo commonly behaves like M/d/yy.
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  }

  // Fallback (safe)
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Format timestamp as relative time / date.
 *
 * Mirrors Angular's `datetimeService.makeRelativeDateString` + `dateAgo` filter.
 *
 * Signature matches Angular arguments:
 * (ts, now_ts, dntShowTime, showShortDate, showAgo, dontAppendText, _format, showNoOfDaysPassed, showNoOfWeeksPassed, dontShowNow)
 */
export function formatDateAgo(
  timestamp: number | string,
  serverNowTimestamp?: number,
  dntShowTime?: boolean,
  showShortDate?: boolean,
  showAgo?: boolean,
  dontAppendText?: boolean,
  _format?: string,
  showNoOfDaysPassed?: boolean,
  showNoOfWeeksPassed?: boolean,
  dontShowNow?: boolean
): string {
  const ts = normalizeAndGetUnixTimestamp(timestamp);
  const now_ts = serverNowTimestamp ? normalizeAndGetUnixTimestamp(serverNowTimestamp) : Date.now();

  let diff = now_ts - ts;
  if (diff < 0) diff = 0;

  // 1d .. 6d  => weekday (or Nd when showNoOfDaysPassed)
  if (diff >= MILLI_SECS_IN_DAY && diff <= MILLI_SECS_IN_DAY * 6) {
    const tmp = new Date(ts);
    if (showNoOfDaysPassed) {
      // Mirrors Angular's day-diff-by-weekday logic (not calendar-accurate, but matches legacy behavior)
      const currentDate = new Date();
      const currentDay = tmp.getDay();
      let dayDiff = currentDate.getDay() - currentDay;
      if (dayDiff < 0) dayDiff = 7 + dayDiff;
      if (dayDiff < 1) dayDiff = 1;
      return `${dayDiff}d`;
    }
    return weekday[tmp.getDay()];
  }

  // >= 6d => formatted date (or weeks when showNoOfWeeksPassed)
  if (diff >= MILLI_SECS_IN_DAY * 6) {
    if (showNoOfWeeksPassed) {
      let w = Math.floor(diff / (MILLI_SECS_IN_DAY * 7));
      if (w <= 0) return '6d';
      return `${w}w`;
    }

    if (_format) {
      const out = formatAngularDate(ts, _format);
      return showAgo ? (dontAppendText ? out : ` on ${out}`) : out;
    }

    const tmpDate = new Date(ts);
    const tmpNowDate = new Date(now_ts);
    // Angular used `getYear()` (year-1900). We use `getFullYear()` for TS compatibility; equality behavior is identical.
    const isSameOrLessThanYear =
      tmpDate.getFullYear() === tmpNowDate.getFullYear() || diff < MILLI_SECS_IN_DAY * 363;

    // Angular: if dntShowTime => "" else "h:mm a, "
    // In feed/comments, Convo usually calls dateAgo with dntShowTime=true.
    const dateStr = isSameOrLessThanYear
      ? formatAngularDate(ts, 'MMM d')
      : formatAngularDate(ts, 'MMM d, yyyy');

    if (showAgo) {
      return dontAppendText ? dateStr : ` on ${dateStr}`;
    }
    return dateStr;
  }

  // < 1d => hours/mins/now
  const date_diff = new Date(diff);
  const hours = date_diff.getUTCHours();
  const mins = date_diff.getUTCMinutes();

  if (showShortDate) {
    let str = '';
    if (hours === 1) str = '1h';
    else if (hours > 1) str = `${hours}h`;
    else if (mins >= 2) str = `${mins}m`;
    else if (mins === 1) str = '1m';
    else {
      str = 'now';
      if (showAgo || dontShowNow) str = '1m';
    }
    if (showAgo) str += ' ago';
    return str;
  }

  // Long form (Angular feed default): "32 mins", "1 min", "2 hours"
  if (hours === 1) return '1 hour';
  if (hours > 1) return `${hours} hours`;
  if (mins >= 2) return `${mins} mins`;
  if (mins === 1) return '1 min';
  return 'now';
}

/**
 * Format timestamp as absolute date (e.g., "Sep 16, 2024")
 * Matches AngularJS localize filter
 */
export function formatLocalizedDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

