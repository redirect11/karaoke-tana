/**
 * tests/unit/karaoke-utils.test.js
 *
 * Unit tests for every function in scripts/karaoke-utils.js.
 * These are pure-function tests – no DOM, no network, no timers.
 */

import { describe, it, expect } from 'vitest';
import utils from '../../scripts/karaoke-utils.js';

const {
  escapeHtml,
  escapeCssUrl,
  renderSimpleMarkdown,
  resolveLanUrl,
  formatPublicDateLabel,
  formatCountdown,
  getHomeCopySettings,
  splitCurrentSongAndQueue,
  normalizeBookingNumber,
  getStoredBookingNumber,
  safeParseBookingCookie,
  normalizePendingExpiryAt,
  getCurrentStoredSerataId,
  getStatusSerataId,
  getWinnerRevealEndsAtMs,
  getWinnerRevealSettings,
  getWinnerRevealStartRank,
  normalizeWinnerRevealRank,
  getWinnerRevealAdminAction,
  setDisplayIndexes,
  buildRanking,
  PENDING_EXPIRY_MIN_DEFAULT,
  DEFAULT_WINNER_REVEAL_AUTO_STEP_SECONDS,
  MIN_WINNER_REVEAL_AUTO_STEP_SECONDS,
  MAX_WINNER_REVEAL_AUTO_STEP_SECONDS,
} = utils;

// ─────────────────────────────────────────────────────────────────────────────
describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than and greater-than', () => {
    expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes all special characters in one string', () => {
    expect(escapeHtml(`<script>alert('xss"&"')</script>`)).toBe(
      '&lt;script&gt;alert(&#39;xss&quot;&amp;&quot;&#39;)&lt;/script&gt;',
    );
  });

  it('handles null by returning empty string', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('handles undefined by returning empty string', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces numbers to strings', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('escapeCssUrl', () => {
  it('escapes backslash', () => {
    expect(escapeCssUrl('path\\to')).toBe('path\\\\to');
  });

  it('escapes double quotes', () => {
    expect(escapeCssUrl('say "hi"')).toBe('say \\"hi\\"');
  });

  it('escapes single quotes', () => {
    expect(escapeCssUrl("it's")).toBe("it\\'s");
  });

  it('escapes opening parenthesis', () => {
    expect(escapeCssUrl('url(path)')).toBe('url\\(path\\)');
  });

  it('escapes closing parenthesis', () => {
    expect(escapeCssUrl('(a)(b)')).toBe('\\(a\\)\\(b\\)');
  });

  it('handles null / undefined as empty string', () => {
    expect(escapeCssUrl(null)).toBe('');
    expect(escapeCssUrl(undefined)).toBe('');
  });

  it('leaves plain URLs unchanged', () => {
    expect(escapeCssUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('renderSimpleMarkdown', () => {
  it('renders markdown bold with double asterisks', () => {
    expect(renderSimpleMarkdown('ciao **mondo**')).toBe('ciao <strong>mondo</strong>');
  });

  it('renders markdown bold with double underscores', () => {
    expect(renderSimpleMarkdown('ciao __mondo__')).toBe('ciao <strong>mondo</strong>');
  });

  it('renders line breaks as br tags', () => {
    expect(renderSimpleMarkdown('riga 1\nriga 2')).toBe('riga 1<br>riga 2');
  });

  it('escapes html before markdown rendering', () => {
    expect(renderSimpleMarkdown('<script>alert(1)</script> **ok**'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt; <strong>ok</strong>');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('resolveLanUrl', () => {
  it('replaces localhost with a LAN IP', () => {
    expect(resolveLanUrl('http://localhost/storage/v1/bucket/file.jpg', '192.168.1.100'))
      .toBe('http://192.168.1.100/storage/v1/bucket/file.jpg');
  });

  it('replaces 127.0.0.1 with a LAN IP', () => {
    expect(resolveLanUrl('http://127.0.0.1:54321/path', '10.0.0.5'))
      .toBe('http://10.0.0.5:54321/path');
  });

  it('leaves URL unchanged when hostname is localhost', () => {
    expect(resolveLanUrl('http://localhost/file', 'localhost'))
      .toBe('http://localhost/file');
  });

  it('leaves URL unchanged when hostname is 127.0.0.1', () => {
    expect(resolveLanUrl('http://localhost/file', '127.0.0.1'))
      .toBe('http://localhost/file');
  });

  it('leaves URLs that already use a real host unchanged', () => {
    const url = 'https://xyz.supabase.co/storage/v1/image.jpg';
    expect(resolveLanUrl(url, '192.168.1.1')).toBe(url);
  });

  it('returns empty string for null / empty input', () => {
    expect(resolveLanUrl(null, '192.168.1.1')).toBe('');
    expect(resolveLanUrl('', '192.168.1.1')).toBe('');
  });

  it('handles https scheme as well', () => {
    expect(resolveLanUrl('https://localhost/file', '192.168.1.5'))
      .toBe('https://192.168.1.5/file');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('formatPublicDateLabel', () => {
  it('formats a valid ISO date with weekday', () => {
    const label = formatPublicDateLabel('2025-12-25', true);
    // Should contain day, month, year; locale-specific so just check fragments
    expect(label).toContain('25');
    expect(label).toContain('12');
    expect(label).toContain('2025');
    // Should include a weekday (giovedì for 25 Dec 2025)
    expect(label.length).toBeGreaterThan(10);
  });

  it('formats without weekday when withWeekday=false', () => {
    const withDay    = formatPublicDateLabel('2025-06-01', true);
    const withoutDay = formatPublicDateLabel('2025-06-01', false);
    // withDay should be longer (includes weekday name)
    expect(withDay.length).toBeGreaterThan(withoutDay.length);
  });

  it('defaults to including the weekday', () => {
    // Calling with two args vs one arg should give the same result
    const implicit = formatPublicDateLabel('2025-06-01');
    const explicit = formatPublicDateLabel('2025-06-01', true);
    expect(implicit).toBe(explicit);
  });

  it('returns empty string for empty input', () => {
    expect(formatPublicDateLabel('')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(formatPublicDateLabel(null)).toBe('');
  });

  it('returns empty string for invalid date strings', () => {
    expect(formatPublicDateLabel('not-a-date')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('formatCountdown', () => {
  it('formats 0 ms as "00:00"', () => {
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('clamps negative values to "00:00"', () => {
    expect(formatCountdown(-5000)).toBe('00:00');
  });

  it('formats 30 seconds', () => {
    expect(formatCountdown(30_000)).toBe('00:30');
  });

  it('formats exactly 1 minute', () => {
    expect(formatCountdown(60_000)).toBe('01:00');
  });

  it('formats 1 minute 30 seconds', () => {
    expect(formatCountdown(90_000)).toBe('01:30');
  });

  it('formats 10 minutes', () => {
    expect(formatCountdown(600_000)).toBe('10:00');
  });

  it('pads single-digit seconds with a leading zero', () => {
    expect(formatCountdown(65_000)).toBe('01:05');
  });

  it('ceils fractional seconds (1001 ms → 2 seconds)', () => {
    expect(formatCountdown(1001)).toBe('00:02');
  });

  it('ceils exactly 1 ms to 1 second', () => {
    expect(formatCountdown(1)).toBe('00:01');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getHomeCopySettings', () => {
  it('returns the default home copy when settings are missing', () => {
    expect(getHomeCopySettings(null)).toEqual({
      subtitleVisible: true,
      subtitle: 'Il karaoke, la votazione e la coda in un unico posto.',
      followTitle: 'Prima di tutto…',
      followMessage: 'Segui la nostra pagina Instagram per poter prenotare una canzone.',
      formTitle: 'Prenota la tua canzone 🎤',
      formMessage: 'Compila il form e lo staff la aggiungerà alla lista appena possibile.',
      successTitle: 'Richiesta inviata!',
      successMessage: 'Lo staff la controllerà e apparirà in lista appena viene approvata.',
      waitingTitle: 'Stato della tua prenotazione',
      waitingMessage: 'Sto controllando lo stato della tua prenotazione…',
      bookingsDisabledTitle: 'Prenotazioni non disponibili',
      bookingsDisabledMessage: 'Le prenotazioni sono al momento chiuse.',
      closedTitle: 'Prenotazioni chiuse',
      closedMessage: 'Al momento non è attiva nessuna serata karaoke.\nTorna più tardi!',
      maintenanceTitle: '🚧 In manutenzione',
      maintenanceMessage: 'Sito in manutenzione. Torneremo presto.\nIntanto segui la nostra pagina per scoprire le ultime novità e le prossime date del karaoke',
    });
  });

  it('uses custom values and falls back for blank strings', () => {
    expect(getHomeCopySettings({
      home_subtitle_enabled: false,
      home_subtitle_text: '  La tua serata  ',
      home_follow_title: '',
      home_follow_message: 'Seguici davvero',
      home_closed_message: 'Linea 1\nLinea 2',
    })).toMatchObject({
      subtitleVisible: false,
      subtitle: 'La tua serata',
      followTitle: 'Prima di tutto…',
      followMessage: 'Seguici davvero',
      closedMessage: 'Linea 1\nLinea 2',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('splitCurrentSongAndQueue', () => {
  it('returns null current song and empty queue for invalid input', () => {
    expect(splitCurrentSongAndQueue(null)).toEqual({
      currentSong: null,
      queueItems: [],
    });
  });

  it('keeps first song as current and rest as queue', () => {
    const songs = [
      { id: 101, canzone: 'A' },
      { id: 102, canzone: 'B' },
      { id: 103, canzone: 'C' },
    ];
    expect(splitCurrentSongAndQueue(songs)).toEqual({
      currentSong: { id: 101, canzone: 'A' },
      queueItems: [
        { id: 102, canzone: 'B' },
        { id: 103, canzone: 'C' },
      ],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeBookingNumber', () => {
  it('returns a positive integer as-is', () => {
    expect(normalizeBookingNumber(5)).toBe(5);
  });

  it('coerces a string representation of a positive integer', () => {
    expect(normalizeBookingNumber('12')).toBe(12);
  });

  it('returns null for zero', () => {
    expect(normalizeBookingNumber(0)).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(normalizeBookingNumber(-3)).toBeNull();
  });

  it('returns null for null', () => {
    expect(normalizeBookingNumber(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeBookingNumber(undefined)).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(normalizeBookingNumber('abc')).toBeNull();
  });

  it('returns null for floats', () => {
    expect(normalizeBookingNumber(1.5)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getStoredBookingNumber', () => {
  it('extracts valid booking number from stored object', () => {
    expect(getStoredBookingNumber({ bookingNumber: 7 })).toBe(7);
  });

  it('returns null when bookingNumber is missing', () => {
    expect(getStoredBookingNumber({})).toBeNull();
  });

  it('returns null for null stored object', () => {
    expect(getStoredBookingNumber(null)).toBeNull();
  });

  it('returns null for non-object stored', () => {
    expect(getStoredBookingNumber('string')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('safeParseBookingCookie', () => {
  it('returns null for null input', () => {
    expect(safeParseBookingCookie(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeParseBookingCookie('')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(safeParseBookingCookie('not json')).toBeNull();
  });

  it('returns null when JSON is a primitive (string)', () => {
    expect(safeParseBookingCookie('"hello"')).toBeNull();
  });

  it('returns null when JSON is a primitive (number)', () => {
    expect(safeParseBookingCookie('42')).toBeNull();
  });

  it('returns null when JSON is null literal', () => {
    expect(safeParseBookingCookie('null')).toBeNull();
  });

  it('returns parsed object for valid JSON object', () => {
    expect(safeParseBookingCookie('{"id":1,"canzone":"Test"}')).toEqual({ id: 1, canzone: 'Test' });
  });

  it('returns parsed object for empty JSON object', () => {
    expect(safeParseBookingCookie('{}')).toEqual({});
  });

  it('returns parsed array for JSON array (truthy object)', () => {
    // An array is technically an object – the function does not reject arrays.
    expect(safeParseBookingCookie('[1,2,3]')).toEqual([1, 2, 3]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('normalizePendingExpiryAt', () => {
  const MIN = 30; // default minutes

  it('returns pendingExpiresAt directly when it is a valid positive timestamp', () => {
    const ts = Date.now() + 60_000;
    expect(normalizePendingExpiryAt({ pendingExpiresAt: ts }, MIN)).toBe(ts);
  });

  it('computes expiry from timestamp + minutes when pendingExpiresAt is absent', () => {
    const base = 1_700_000_000_000;
    const result = normalizePendingExpiryAt({ timestamp: base }, MIN);
    expect(result).toBe(base + MIN * 60 * 1000);
  });

  it('falls back to timestamp when pendingExpiresAt is 0', () => {
    const base = 1_700_000_000_000;
    const result = normalizePendingExpiryAt({ timestamp: base, pendingExpiresAt: 0 }, MIN);
    expect(result).toBe(base + MIN * 60 * 1000);
  });

  it('returns null when both pendingExpiresAt and timestamp are absent', () => {
    expect(normalizePendingExpiryAt({}, MIN)).toBeNull();
  });

  it('returns null when timestamp is 0', () => {
    expect(normalizePendingExpiryAt({ timestamp: 0 }, MIN)).toBeNull();
  });

  it('returns null when timestamp is negative', () => {
    expect(normalizePendingExpiryAt({ timestamp: -1 }, MIN)).toBeNull();
  });

  it('uses PENDING_EXPIRY_MIN_DEFAULT when no expiryMin argument is provided', () => {
    const base = 1_700_000_000_000;
    const result = normalizePendingExpiryAt({ timestamp: base });
    expect(result).toBe(base + PENDING_EXPIRY_MIN_DEFAULT * 60 * 1000);
  });

  it('honours custom pendingExpiryMin', () => {
    const base = 1_700_000_000_000;
    expect(normalizePendingExpiryAt({ timestamp: base }, 15))
      .toBe(base + 15 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getCurrentStoredSerataId', () => {
  it('returns serataId when it is a positive integer', () => {
    expect(getCurrentStoredSerataId({ serataId: 42 })).toBe(42);
  });

  it('returns null for serataId = 0', () => {
    expect(getCurrentStoredSerataId({ serataId: 0 })).toBeNull();
  });

  it('returns null for negative serataId', () => {
    expect(getCurrentStoredSerataId({ serataId: -1 })).toBeNull();
  });

  it('returns null when serataId is absent', () => {
    expect(getCurrentStoredSerataId({})).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getCurrentStoredSerataId(null)).toBeNull();
  });

  it('coerces numeric string to integer', () => {
    expect(getCurrentStoredSerataId({ serataId: '5' })).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getStatusSerataId', () => {
  it('returns serata_id when it is a positive integer', () => {
    expect(getStatusSerataId({ serata_id: 7 })).toBe(7);
  });

  it('returns null for serata_id = 0', () => {
    expect(getStatusSerataId({ serata_id: 0 })).toBeNull();
  });

  it('returns null when field is absent', () => {
    expect(getStatusSerataId({})).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getStatusSerataId(null)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getWinnerRevealEndsAtMs', () => {
  it('parses a valid ISO string and returns a numeric timestamp', () => {
    const iso = '2025-12-25T20:00:00.000Z';
    const expected = new Date(iso).getTime();
    expect(getWinnerRevealEndsAtMs({ winner_reveal_countdown_ends_at: iso })).toBe(expected);
  });

  it('returns null when the field is an invalid date string', () => {
    expect(getWinnerRevealEndsAtMs({ winner_reveal_countdown_ends_at: 'not-a-date' })).toBeNull();
  });

  it('returns null when the field is absent', () => {
    expect(getWinnerRevealEndsAtMs({})).toBeNull();
  });

  it('returns null for null serata', () => {
    expect(getWinnerRevealEndsAtMs(null)).toBeNull();
  });

  it('returns null when field is a number (not a string)', () => {
    expect(getWinnerRevealEndsAtMs({ winner_reveal_countdown_ends_at: 12345 })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getWinnerRevealSettings', () => {
  it('defaults to enabled + automatic + default auto seconds', () => {
    expect(getWinnerRevealSettings(null)).toEqual({
      enabled: true,
      mode: 'automatic',
      autoStepSeconds: DEFAULT_WINNER_REVEAL_AUTO_STEP_SECONDS,
    });
  });

  it('supports manual mode and disabled animation', () => {
    expect(getWinnerRevealSettings({
      winner_reveal_animation_enabled: false,
      winner_reveal_animation_mode: 'manual',
      winner_reveal_auto_step_seconds: 7,
    })).toEqual({
      enabled: false,
      mode: 'manual',
      autoStepSeconds: 7,
    });
  });

  it('falls back to default auto seconds when out of range', () => {
    const low = getWinnerRevealSettings({ winner_reveal_auto_step_seconds: MIN_WINNER_REVEAL_AUTO_STEP_SECONDS - 1 });
    const high = getWinnerRevealSettings({ winner_reveal_auto_step_seconds: MAX_WINNER_REVEAL_AUTO_STEP_SECONDS + 1 });
    expect(low.autoStepSeconds).toBe(DEFAULT_WINNER_REVEAL_AUTO_STEP_SECONDS);
    expect(high.autoStepSeconds).toBe(DEFAULT_WINNER_REVEAL_AUTO_STEP_SECONDS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getWinnerRevealStartRank', () => {
  it('returns null for empty rankings', () => {
    expect(getWinnerRevealStartRank(0)).toBeNull();
  });

  it('caps reveal start rank to top-5', () => {
    expect(getWinnerRevealStartRank(10)).toBe(5);
  });

  it('returns ranking length when below top-5', () => {
    expect(getWinnerRevealStartRank(3)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeWinnerRevealRank', () => {
  it('returns null when rank is outside reveal range', () => {
    expect(normalizeWinnerRevealRank(6, 8)).toBeNull();
    expect(normalizeWinnerRevealRank(0, 8)).toBeNull();
  });

  it('returns rank when valid', () => {
    expect(normalizeWinnerRevealRank(4, 8)).toBe(4);
  });

  it('returns null when ranking is empty', () => {
    expect(normalizeWinnerRevealRank(1, 0)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getWinnerRevealAdminAction', () => {
  it('returns null when no further reveal action is available', () => {
    expect(getWinnerRevealAdminAction(1)).toBeNull();
    expect(getWinnerRevealAdminAction(null)).toBeNull();
  });

  it('returns winner action when current rank is 2', () => {
    expect(getWinnerRevealAdminAction(2)).toEqual({ label: '🏆 Svela vincitore', winnerAction: true });
  });

  it('returns positional action when current rank is above 2', () => {
    expect(getWinnerRevealAdminAction(5)).toEqual({ label: 'Svela la posizione 4', winnerAction: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('setDisplayIndexes', () => {
  it('assigns 1-based chronological indexes', () => {
    const songs = [
      { id: 10, created_at: '2025-01-03T00:00:00Z' },
      { id: 20, created_at: '2025-01-01T00:00:00Z' },
      { id: 30, created_at: '2025-01-02T00:00:00Z' },
    ];
    setDisplayIndexes(songs);
    // Oldest song (id=20) gets index 1, then id=30 gets 2, id=10 gets 3
    expect(songs.find(s => s.id === 20)._displayIndex).toBe(1);
    expect(songs.find(s => s.id === 30)._displayIndex).toBe(2);
    expect(songs.find(s => s.id === 10)._displayIndex).toBe(3);
  });

  it('does not reorder the original array', () => {
    const songs = [
      { id: 2, created_at: '2025-01-02T00:00:00Z' },
      { id: 1, created_at: '2025-01-01T00:00:00Z' },
    ];
    setDisplayIndexes(songs);
    // Original order preserved
    expect(songs[0].id).toBe(2);
    expect(songs[1].id).toBe(1);
  });

  it('uses id as tiebreaker when created_at is identical', () => {
    const sameTs = '2025-01-01T00:00:00Z';
    const songs = [
      { id: 3, created_at: sameTs },
      { id: 1, created_at: sameTs },
      { id: 2, created_at: sameTs },
    ];
    setDisplayIndexes(songs);
    expect(songs.find(s => s.id === 1)._displayIndex).toBe(1);
    expect(songs.find(s => s.id === 2)._displayIndex).toBe(2);
    expect(songs.find(s => s.id === 3)._displayIndex).toBe(3);
  });

  it('handles an empty list', () => {
    expect(() => setDisplayIndexes([])).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('buildRanking', () => {
  const makeSong = (id, sum, count, created_at = '2025-01-01T00:00:00Z') => ({
    id,
    created_at,
    _scores: { sum, count },
  });

  it('sorts by total score descending', () => {
    const songs = [makeSong(1, 5, 1), makeSong(2, 10, 2), makeSong(3, 3, 1)];
    const ranking = buildRanking(songs);
    expect(ranking.map(s => s.id)).toEqual([2, 1, 3]);
  });

  it('breaks ties by average score descending', () => {
    // Both have sum=10, but id=1 has count=2 (avg 5) and id=2 has count=5 (avg 2)
    const songs = [makeSong(1, 10, 2), makeSong(2, 10, 5)];
    const ranking = buildRanking(songs);
    expect(ranking[0].id).toBe(1);
  });

  it('breaks avg tie by vote count descending', () => {
    // Both have avg=5; id=2 has more votes
    const songs = [makeSong(1, 5, 1), makeSong(2, 10, 2)];
    const ranking = buildRanking(songs);
    // avg of id=1 is 5, avg of id=2 is 5, but total of id=2 is 10 > 5 → id=2 first
    expect(ranking[0].id).toBe(2);
  });

  it('breaks all-equal tie by created_at ascending', () => {
    const songs = [
      { id: 2, created_at: '2025-01-02T00:00:00Z', _scores: { sum: 5, count: 1 } },
      { id: 1, created_at: '2025-01-01T00:00:00Z', _scores: { sum: 5, count: 1 } },
    ];
    const ranking = buildRanking(songs);
    // Earlier created_at comes first when all scores equal
    expect(ranking[0].id).toBe(1);
  });

  it('adds scoreTotal, scoreCount, scoreAvg fields', () => {
    const [ranked] = buildRanking([makeSong(1, 15, 3)]);
    expect(ranked.scoreTotal).toBe(15);
    expect(ranked.scoreCount).toBe(3);
    expect(ranked.scoreAvg).toBeCloseTo(5);
  });

  it('scores absent _scores as 0 / 0', () => {
    const songs = [{ id: 1, created_at: '2025-01-01T00:00:00Z' }];
    const [ranked] = buildRanking(songs);
    expect(ranked.scoreTotal).toBe(0);
    expect(ranked.scoreCount).toBe(0);
    expect(ranked.scoreAvg).toBe(0);
  });

  it('does not mutate the original array', () => {
    const songs = [makeSong(2, 10, 2), makeSong(1, 20, 4)];
    buildRanking(songs);
    expect(songs[0].id).toBe(2); // original order preserved
  });

  it('handles empty input', () => {
    expect(buildRanking([])).toEqual([]);
  });
});
