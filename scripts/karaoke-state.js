/**
 * karaoke-state.js
 *
 * Pure state-computation functions for the karaoke application.
 * These functions implement the decision logic for UI state transitions
 * without touching the DOM.  They are intended to be unit-tested and
 * serve as the authoritative specification for the state machine.
 *
 * Browser usage:
 *   <script src="scripts/karaoke-state.js"></script>
 *
 * Test / Node.js usage:
 *   const state = require('./scripts/karaoke-state.js');
 *   const { computeSerataUiState } = state;
 */
(function (root, factory) {
  /* global module */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else /* c8 ignore next */ {
    /* c8 ignore next 3 */
    var exports = factory();
    Object.assign(root, exports);
    root.KaraokeState = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : /* c8 ignore next */ this, function () {

  // ── Serata UI state ──────────────────────────────────────────────────────
  //
  // Possible uiState values:
  //   'closed'           – no serata is open (no record, or aperta=false)
  //   'winner-decreed'   – a winner has been officially announced
  //   'reveal-countdown' – the winner-reveal countdown is active
  //   'open'             – a normal open session; bookingsEnabled / votingOpen carry flags

  /**
   * Derive the UI state and derived flags from a raw serata database record.
   *
   * @param {object|null} serataData - Row from the `serate` table (or null).
   * @returns {{
   *   uiState: 'closed'|'winner-decreed'|'reveal-countdown'|'open',
   *   bookingsEnabled: boolean,
   *   votingOpen: boolean,
   * }}
   */
  function computeSerataUiState(serataData) {
    if (!serataData) {
      return { uiState: 'closed', bookingsEnabled: false, votingOpen: false };
    }

    if (Boolean(serataData.vincitore_decretato)) {
      return { uiState: 'winner-decreed', bookingsEnabled: false, votingOpen: false };
    }

    if (Boolean(serataData.winner_reveal_countdown_active)) {
      return {
        uiState: 'reveal-countdown',
        bookingsEnabled: false,
        votingOpen: Boolean(serataData.voto_aperto),
      };
    }

    return {
      uiState: 'open',
      bookingsEnabled: serataData.prenotazioni_abilitate !== false,
      votingOpen: Boolean(serataData.voto_aperto),
    };
  }

  // ── Booking cookie state ─────────────────────────────────────────────────
  //
  // Possible action values:
  //   'none'         – no stored booking (no cookie / empty)
  //   'invalid'      – stored booking has an invalid/missing id
  //   'stale-serata' – booking belongs to a different (old) serata
  //   'expired'      – pending booking whose waiting window has elapsed
  //   'approved'     – booking has been approved by staff
  //   'pending'      – booking is awaiting staff approval

  /**
   * Determine what the client should do with the currently stored booking
   * cookie without making any network requests.
   *
   * @param {object|null} stored - Parsed value of the `last_booking` cookie.
   * @param {number|null} currentSerataId - ID of the currently open serata.
   * @param {number} [pendingExpiryMin=30] - Pending-expiry window in minutes.
   * @param {number} [now=Date.now()] - Current timestamp (injectable for tests).
   * @returns {{
   *   action: 'none'|'invalid'|'stale-serata'|'expired'|'approved'|'pending',
   *   bookingId?: number,
   *   pendingExpiryAt?: number|null,
   * }}
   */
  function computeBookingCookieAction(stored, currentSerataId, pendingExpiryMin, now) {
    if (pendingExpiryMin === undefined) pendingExpiryMin = 30;
    if (now === undefined) now = Date.now();

    if (!stored) return { action: 'none' };

    var bookingId = Number(stored.id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return { action: 'invalid' };
    }

    var storedSerataId = Number(stored.serataId);
    if (
      Number.isInteger(currentSerataId) && currentSerataId > 0 &&
      Number.isInteger(storedSerataId) && storedSerataId > 0 &&
      storedSerataId !== currentSerataId
    ) {
      return { action: 'stale-serata', bookingId: bookingId };
    }

    // A null / undefined pendingExpiresAt means the booking was already approved.
    var isApproved = stored.pendingExpiresAt === null || stored.pendingExpiresAt === undefined;
    if (isApproved) {
      return { action: 'approved', bookingId: bookingId };
    }

    // Compute when the pending window expires.
    var directExpiry = Number(stored.pendingExpiresAt);
    var pendingExpiryAt;
    if (Number.isFinite(directExpiry) && directExpiry > 0) {
      pendingExpiryAt = directExpiry;
    } else {
      var timestamp = Number(stored.timestamp);
      pendingExpiryAt = (Number.isFinite(timestamp) && timestamp > 0)
        ? timestamp + (pendingExpiryMin * 60 * 1000)
        : null;
    }

    if (pendingExpiryAt && now >= pendingExpiryAt) {
      return { action: 'expired', bookingId: bookingId, pendingExpiryAt: pendingExpiryAt };
    }

    return { action: 'pending', bookingId: bookingId, pendingExpiryAt: pendingExpiryAt };
  }

  // ── Queue position ───────────────────────────────────────────────────────
  //
  // Possible status values:
  //   'no-booking' – no valid booking id available
  //   'not-found'  – booking is not in the "to-sing" queue
  //   'turn'       – booking is first in the queue (index 0)
  //   'next'       – booking is second in the queue (index 1)
  //   'waiting'    – booking is further down the queue (index >= 2)

  /**
   * Compute the position and status of a booking in the to-sing queue.
   *
   * @param {number|null} bookingId - The booking to look up.
   * @param {Array<{id: number}>} queueItems - The current to-sing queue.
   * @returns {{
   *   index: number,
   *   status: 'no-booking'|'not-found'|'turn'|'next'|'waiting',
   * }}
   */
  function computeQueuePosition(bookingId, queueItems) {
    if (!Array.isArray(queueItems)) return { index: -1, status: 'no-booking' };
    var bookingIdNum = Number(bookingId);
    if (!Number.isInteger(bookingIdNum) || bookingIdNum <= 0) {
      return { index: -1, status: 'no-booking' };
    }

    var index = queueItems.findIndex(function (item) {
      return Number(item && item.id) === bookingIdNum;
    });

    if (index === -1) return { index: -1, status: 'not-found' };
    if (index === 0)  return { index: 0,  status: 'turn' };
    if (index === 1)  return { index: 1,  status: 'next' };
    return { index: index, status: 'waiting' };
  }

  // ── Vote page banner ─────────────────────────────────────────────────────
  //
  // Possible banner values (match the text shown in updateBanner() in vota.html):
  //   'voting-open'      – votes are open
  //   'winner-decreed'   – winner has been announced, voting is over
  //   'reveal-countdown' – live reveal countdown is active
  //   'voting-closed'    – serata is open but votes are currently closed

  /**
   * Compute which banner message should be shown on the vote page.
   *
   * @param {{ voto_aperto?: boolean, vincitore_decretato?: boolean, winner_reveal_countdown_active?: boolean }|null} serata
   * @param {boolean} [forceReveal=false] - Override used after countdown expires client-side.
   * @returns {'voting-open'|'winner-decreed'|'reveal-countdown'|'voting-closed'}
   */
  function computeVoteBanner(serata, forceReveal) {
    if (forceReveal) return 'winner-decreed';
    if (!serata) return 'voting-closed';
    // vincitore_decretato takes precedence: once a winner is decreed voting is over
    // regardless of whether voto_aperto was reset.
    if (Boolean(serata.vincitore_decretato)) return 'winner-decreed';
    if (Boolean(serata.voto_aperto)) return 'voting-open';
    if (Boolean(serata.winner_reveal_countdown_active)) return 'reveal-countdown';
    return 'voting-closed';
  }

  // ── Admin panel serata dot-color ─────────────────────────────────────────
  //
  // Returns the CSS class applied to the <details class="serata-collapsible">
  // element in admin.html to drive the summary-dot colour and panel accent.
  //
  // Possible values (match admin.html):
  //   'is-closed'       – no serata is open
  //   'is-proclamation' – reveal countdown active and winner not yet decreed
  //   'is-warning'      – open serata but bookings are disabled
  //   'is-open'         – normal open serata with bookings enabled

  /**
   * Compute the CSS status-class for the admin serata panel.
   *
   * @param {object|null} serataData - Row from the `serate` table (or null).
   * @returns {'is-closed'|'is-proclamation'|'is-warning'|'is-open'}
   */
  function computeAdminSerataColor(serataData) {
    if (!serataData) return 'is-closed';
    var inProclamazioneMode =
      Boolean(serataData.winner_reveal_countdown_active) &&
      !Boolean(serataData.vincitore_decretato);
    if (inProclamazioneMode) return 'is-proclamation';
    if (serataData.prenotazioni_abilitate === false) return 'is-warning';
    return 'is-open';
  }

  return {
    computeSerataUiState: computeSerataUiState,
    computeBookingCookieAction: computeBookingCookieAction,
    computeQueuePosition: computeQueuePosition,
    computeVoteBanner: computeVoteBanner,
    computeAdminSerataColor: computeAdminSerataColor,
  };
});
