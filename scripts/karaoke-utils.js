/**
 * karaoke-utils.js
 *
 * Pure utility functions shared across the karaoke frontend pages.
 * Loaded as a regular <script> in HTML (assigns to window) and as a
 * CJS module in Node.js / test environments.
 *
 * Browser usage: include this file BEFORE the page's own <script> block.
 *   <script src="scripts/karaoke-utils.js"></script>
 *
 * Test / Node.js usage:
 *   const utils = require('./scripts/karaoke-utils.js');
 *   const { formatCountdown } = utils;
 */
(function (root, factory) {
  /* global module */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    // Expose each function directly on the global (window) so existing
    // page scripts can call them without the KaraokeUtils namespace.
    Object.assign(root, exports);
    root.KaraokeUtils = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : /* istanbul ignore next */ this, function () {

  // ── String escaping ──────────────────────────────────────────────────────

  /**
   * Escape a value for safe insertion into HTML content / attributes.
   * Escapes: & < > " '
   */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  /**
   * Escape a URL string for safe use inside CSS url() values.
   * Escapes: \ " ' ( )
   */
  function escapeCssUrl(value) {
    return String(value == null ? '' : value)
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"')
      .replaceAll("'", "\\'")
      .replaceAll('(', '\\(')
      .replaceAll(')', '\\)');
  }

  // ── URL helpers ──────────────────────────────────────────────────────────

  /**
   * Re-write Supabase URLs that were saved with host "localhost" / "127.0.0.1"
   * when the page is opened from a different host on the same LAN.
   *
   * @param {string} url  - The URL to resolve.
   * @param {string} [hostname] - Override for the current hostname.
   *   Defaults to window.location.hostname when running in a browser.
   *   Pass an explicit value when testing.
   */
  function resolveLanUrl(url, hostname) {
    if (typeof url !== 'string' || !url) return url || '';
    var host = hostname !== undefined
      ? hostname
      : (typeof window !== 'undefined' && window.location ? window.location.hostname : '');
    if (!host || host === 'localhost' || host === '127.0.0.1') return url;
    return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/, '$1' + host + '$3');
  }

  // ── Date / time formatting ───────────────────────────────────────────────

  /**
   * Format an ISO date string (YYYY-MM-DD) as a localised Italian label.
   *
   * @param {string|null} dateIso - ISO date string.
   * @param {boolean} [withWeekday=true] - Include the weekday name.
   * @returns {string}
   */
  function formatPublicDateLabel(dateIso, withWeekday) {
    if (withWeekday === undefined) withWeekday = true;
    if (!dateIso) return '';
    var parts = String(dateIso).split('-').map(Number);
    var year = parts[0], month = parts[1], day = parts[2];
    if (!year || !month || !day) return '';
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('it-IT', {
      weekday: withWeekday ? 'long' : undefined,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).trim();
  }

  /**
   * Format a millisecond duration as "MM:SS".
   * Negative values are clamped to zero.
   *
   * @param {number} ms
   * @returns {string}
   */
  function formatCountdown(ms) {
    var totalSec = Math.max(0, Math.ceil(ms / 1000));
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  // ── Booking helpers ──────────────────────────────────────────────────────

  /**
   * Normalise a booking number value.
   * Returns a positive integer, or null when the value is invalid.
   *
   * @param {*} value
   * @returns {number|null}
   */
  function normalizeBookingNumber(value) {
    var number = Number(value);
    if (!Number.isInteger(number) || number <= 0) return null;
    return number;
  }

  /**
   * Extract the booking number from a stored booking object.
   *
   * @param {object|null} storedBooking
   * @returns {number|null}
   */
  function getStoredBookingNumber(storedBooking) {
    if (!storedBooking || typeof storedBooking !== 'object') return null;
    return normalizeBookingNumber(storedBooking.bookingNumber);
  }

  /**
   * Safely parse the JSON value stored in the "last_booking" cookie.
   * Returns null when the value is missing, invalid JSON, or not an object.
   *
   * @param {string|null} rawValue
   * @returns {object|null}
   */
  function safeParseBookingCookie(rawValue) {
    if (!rawValue) return null;
    try {
      var parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  /**
   * Default pending-expiry duration in minutes (mirrors the server default).
   * @type {number}
   */
  var PENDING_EXPIRY_MIN_DEFAULT = 30;

  /**
   * Compute the UTC timestamp (ms) at which a pending booking should be
   * considered expired.
   *
   * Priority:
   *   1. storedBooking.pendingExpiresAt  (direct ms timestamp)
   *   2. storedBooking.timestamp + pendingExpiryMin minutes
   *
   * Returns null when neither source provides a valid value.
   *
   * @param {object} storedBooking
   * @param {number} [pendingExpiryMin=30]
   * @returns {number|null}
   */
  function normalizePendingExpiryAt(storedBooking, pendingExpiryMin) {
    if (pendingExpiryMin === undefined) pendingExpiryMin = PENDING_EXPIRY_MIN_DEFAULT;
    var direct = Number(storedBooking.pendingExpiresAt);
    if (Number.isFinite(direct) && direct > 0) return direct;
    var timestamp = Number(storedBooking.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
    return timestamp + (pendingExpiryMin * 60 * 1000);
  }

  // ── Serata ID helpers ────────────────────────────────────────────────────

  /**
   * Extract a valid serata ID from a stored booking object.
   *
   * @param {object|null} stored
   * @returns {number|null}
   */
  function getCurrentStoredSerataId(stored) {
    var serataId = Number(stored == null ? NaN : stored.serataId);
    if (!Number.isInteger(serataId) || serataId <= 0) return null;
    return serataId;
  }

  /**
   * Extract a valid serata ID from a booking-status API response.
   *
   * @param {object|null} status
   * @returns {number|null}
   */
  function getStatusSerataId(status) {
    var serataId = Number(status == null ? NaN : status.serata_id);
    if (!Number.isInteger(serataId) || serataId <= 0) return null;
    return serataId;
  }

  /**
   * Parse the winner-reveal countdown end timestamp from a serata record.
   * Returns null when the field is absent or cannot be parsed.
   *
   * @param {object|null} serata
   * @returns {number|null}
   */
  function getWinnerRevealEndsAtMs(serata) {
    var iso = typeof (serata == null ? undefined : serata.winner_reveal_countdown_ends_at) === 'string'
      ? serata.winner_reveal_countdown_ends_at
      : '';
    var ts = Date.parse(iso);
    return Number.isFinite(ts) ? ts : null;
  }

  // ── Song list helpers ────────────────────────────────────────────────────

  /**
   * Assign a 1-based chronological display index to each item in a song list.
   * Mutates each item in-place by adding a `_displayIndex` property.
   *
   * @param {Array<{id: number, created_at?: string, _displayIndex?: number}>} list
   */
  function setDisplayIndexes(list) {
    var chronological = list.slice().sort(function (a, b) {
      var aTime = Date.parse(String(a && a.created_at ? a.created_at : ''));
      var bTime = Date.parse(String(b && b.created_at ? b.created_at : ''));
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
      return Number(a && a.id ? a.id : 0) - Number(b && b.id ? b.id : 0);
    });
    var idxMap = new Map();
    chronological.forEach(function (item, idx) {
      idxMap.set(Number(item.id), idx + 1);
    });
    list.forEach(function (item) {
      item._displayIndex = idxMap.get(Number(item.id)) || null;
    });
  }

  /**
   * Build a sorted ranking array from a list of songs with score data.
   * Primary sort: total score (desc).
   * Tie-break: average score (desc), vote count (desc), created_at (asc).
   *
   * @param {Array<object>} songs - Each item may have `_scores: {sum, count}`.
   * @returns {Array<object>} Ranked items with added scoreTotal, scoreCount, scoreAvg fields.
   */
  function buildRanking(songs) {
    return songs.slice()
      .map(function (song) {
        var score = song._scores || { sum: 0, count: 0 };
        var avg = score.count > 0 ? score.sum / score.count : 0;
        return Object.assign({}, song, { scoreTotal: score.sum, scoreCount: score.count, scoreAvg: avg });
      })
      .sort(function (a, b) {
        if (b.scoreTotal !== a.scoreTotal) return b.scoreTotal - a.scoreTotal;
        if (b.scoreAvg !== a.scoreAvg) return b.scoreAvg - a.scoreAvg;
        if (b.scoreCount !== a.scoreCount) return b.scoreCount - a.scoreCount;
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });
  }

  return {
    escapeHtml: escapeHtml,
    escapeCssUrl: escapeCssUrl,
    resolveLanUrl: resolveLanUrl,
    formatPublicDateLabel: formatPublicDateLabel,
    formatCountdown: formatCountdown,
    normalizeBookingNumber: normalizeBookingNumber,
    getStoredBookingNumber: getStoredBookingNumber,
    safeParseBookingCookie: safeParseBookingCookie,
    normalizePendingExpiryAt: normalizePendingExpiryAt,
    getCurrentStoredSerataId: getCurrentStoredSerataId,
    getStatusSerataId: getStatusSerataId,
    getWinnerRevealEndsAtMs: getWinnerRevealEndsAtMs,
    setDisplayIndexes: setDisplayIndexes,
    buildRanking: buildRanking,
    PENDING_EXPIRY_MIN_DEFAULT: PENDING_EXPIRY_MIN_DEFAULT,
  };
});
