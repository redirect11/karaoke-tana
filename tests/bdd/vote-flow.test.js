/**
 * tests/bdd/vote-flow.test.js
 *
 * BDD specification for the voting-page (vota.html) state combinations.
 *
 * Covers:
 *   1. Vote banner text based on serata state (computeVoteBanner)
 *   2. Local vote persistence (getLocalVote / setLocalVote logic)
 *   3. buildRanking tie-break rules and ranking computation
 *   4. setDisplayIndexes (chronological display numbering)
 *
 * Requirement matrix for vote banner:
 *
 *  | voto_aperto | vincitore_decretato | countdown_active | forceReveal | banner            |
 *  |-------------|---------------------|------------------|-------------|-------------------|
 *  | true        | false               | false            | false       | voting-open       |
 *  | false       | false               | false            | false       | voting-closed     |
 *  | false       | true                | false            | false       | winner-decreed    |
 *  | false       | false               | true             | false       | reveal-countdown  |
 *  | any         | any                 | any              | true        | winner-decreed    |
 */

import { describe, it, expect } from 'vitest';
import state from '../../scripts/karaoke-state.js';
import utils from '../../scripts/karaoke-utils.js';

const { computeVoteBanner } = state;
const { buildRanking, setDisplayIndexes } = utils;

// ── Factory helpers ──────────────────────────────────────────────────────────

function serata(overrides = {}) {
  return {
    id: 1,
    aperta: true,
    voto_aperto: false,
    vincitore_decretato: false,
    vincitore_prenotazione_id: null,
    winner_reveal_countdown_active: false,
    winner_reveal_countdown_ends_at: null,
    mostra_voti_totali: false,
    ...overrides,
  };
}

function song(id, sum, count, created_at = `2025-01-0${id}T00:00:00Z`) {
  return { id, nome: `Singer ${id}`, canzone: `Song ${id}`, artista: `Artist ${id}`,
           created_at, _scores: { sum, count } };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: Vote-page banner state', () => {

  describe('Scenario: Voting is open', () => {
    it('shows "voting-open" banner', () => {
      expect(computeVoteBanner(serata({ voto_aperto: true }))).toBe('voting-open');
    });
  });

  describe('Scenario: Voting is closed, no winner yet', () => {
    it('shows "voting-closed" banner', () => {
      expect(computeVoteBanner(serata({ voto_aperto: false }))).toBe('voting-closed');
    });
  });

  describe('Scenario: Winner has been officially decreed', () => {
    it('shows "winner-decreed" banner', () => {
      expect(computeVoteBanner(serata({ voto_aperto: false, vincitore_decretato: true })))
        .toBe('winner-decreed');
    });

    it('shows "winner-decreed" even when voto_aperto is still true', () => {
      expect(computeVoteBanner(serata({ voto_aperto: true, vincitore_decretato: true })))
        .toBe('winner-decreed');
    });
  });

  describe('Scenario: Reveal countdown is active', () => {
    it('shows "reveal-countdown" banner', () => {
      expect(computeVoteBanner(serata({ winner_reveal_countdown_active: true })))
        .toBe('reveal-countdown');
    });
  });

  describe('Scenario: forceReveal override (countdown expired client-side)', () => {
    it('shows "winner-decreed" regardless of serata flags when forceReveal=true', () => {
      expect(computeVoteBanner(serata({ voto_aperto: true }), true)).toBe('winner-decreed');
    });

    it('shows "winner-decreed" even when serata is null', () => {
      expect(computeVoteBanner(null, true)).toBe('winner-decreed');
    });
  });

  describe('Scenario: serata is null (no open session)', () => {
    it('shows "voting-closed" banner', () => {
      expect(computeVoteBanner(null)).toBe('voting-closed');
    });
  });

  // ── Banner matrix ─────────────────────────────────────────────────────────
  describe('Complete banner matrix', () => {
    const cases = [
      // [label, serataData, forceReveal, expectedBanner]
      ['vote open',             serata({ voto_aperto: true }),                                false, 'voting-open'],
      ['vote closed',          serata({ voto_aperto: false }),                               false, 'voting-closed'],
      ['winner decreed',       serata({ vincitore_decretato: true }),                        false, 'winner-decreed'],
      ['countdown active',     serata({ winner_reveal_countdown_active: true }),             false, 'reveal-countdown'],
      ['forceReveal=true',     serata({ voto_aperto: true }),                                true,  'winner-decreed'],
      ['forceReveal, no serata', null,                                                       true,  'winner-decreed'],
    ];

    it.each(cases)('%s', (_label, s, forceReveal, expected) => {
      expect(computeVoteBanner(s, forceReveal)).toBe(expected);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: Local vote persistence (getLocalVote / setLocalVote)', () => {
  /**
   * The actual getLocalVote / setLocalVote functions in vota.html use
   * localStorage, which is not available in the Node test environment.
   * We therefore test the equivalent logic directly to verify the spec.
   */

  function makeLocalVoteStore() {
    const store = {};
    function saveLocalVotes() { /* no-op in test */ }
    function getLocalVote(songId) {
      return store[String(songId)] || null;
    }
    function setLocalVote(songId, voto, dbId) {
      const key = String(songId);
      const previousDbId = store[key] && store[key].db_id;
      store[key] = { voto };
      if (dbId !== null && dbId !== undefined) {
        store[key].db_id = dbId;
      } else if (previousDbId) {
        store[key].db_id = previousDbId;
      }
    }
    return { getLocalVote, setLocalVote, saveLocalVotes, _store: store };
  }

  describe('Scenario: No vote has been cast yet', () => {
    it('returns null for an unknown song id', () => {
      const { getLocalVote } = makeLocalVoteStore();
      expect(getLocalVote(42)).toBeNull();
    });
  });

  describe('Scenario: Casting a vote for the first time', () => {
    it('stores the vote value', () => {
      const { getLocalVote, setLocalVote } = makeLocalVoteStore();
      setLocalVote(1, 4, 99);
      expect(getLocalVote(1).voto).toBe(4);
    });

    it('stores the database row id', () => {
      const { getLocalVote, setLocalVote } = makeLocalVoteStore();
      setLocalVote(1, 4, 99);
      expect(getLocalVote(1).db_id).toBe(99);
    });
  });

  describe('Scenario: Updating an existing vote', () => {
    it('updates the vote value', () => {
      const { getLocalVote, setLocalVote } = makeLocalVoteStore();
      setLocalVote(1, 3, 55);
      setLocalVote(1, 5, 55);
      expect(getLocalVote(1).voto).toBe(5);
    });

    it('preserves the db_id when null is passed', () => {
      const { getLocalVote, setLocalVote } = makeLocalVoteStore();
      setLocalVote(1, 3, 55);
      setLocalVote(1, 5, null);  // update vote without changing db_id
      expect(getLocalVote(1).db_id).toBe(55);
    });

    it('overwrites the db_id when a new one is provided', () => {
      const { getLocalVote, setLocalVote } = makeLocalVoteStore();
      setLocalVote(1, 3, 55);
      setLocalVote(1, 5, 77);
      expect(getLocalVote(1).db_id).toBe(77);
    });
  });

  describe('Scenario: Votes for different songs are independent', () => {
    it('stores separate votes per song', () => {
      const { getLocalVote, setLocalVote } = makeLocalVoteStore();
      setLocalVote(1, 4, 10);
      setLocalVote(2, 2, 20);
      expect(getLocalVote(1).voto).toBe(4);
      expect(getLocalVote(2).voto).toBe(2);
    });
  });

  describe('Scenario: Song id is treated as a string key', () => {
    it('retrieves a vote stored with numeric id via string id', () => {
      const { getLocalVote, setLocalVote } = makeLocalVoteStore();
      setLocalVote(42, 5, 1);
      expect(getLocalVote('42').voto).toBe(5);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: buildRanking (vote-page leaderboard)', () => {

  describe('Scenario: Songs with distinct total scores', () => {
    it('ranks highest total score first', () => {
      const songs = [song(1, 5, 1), song(2, 15, 3), song(3, 8, 2)];
      const ranking = buildRanking(songs);
      expect(ranking.map(s => s.id)).toEqual([2, 3, 1]);
    });
  });

  describe('Scenario: Two songs with equal total, different averages', () => {
    it('ranks higher average first', () => {
      // Both sum=10; id=1 avg=5 (2 votes), id=2 avg=3.33 (3 votes)
      const songs = [song(1, 10, 2), song(2, 10, 3)];
      const ranking = buildRanking(songs);
      expect(ranking[0].id).toBe(1);
    });
  });

  describe('Scenario: Two songs equal total AND equal average, different count', () => {
    it('ranks more votes first', () => {
      // id=1: sum=10, count=2, avg=5; id=2: sum=5, count=1, avg=5
      const songs = [song(1, 10, 2), song(2, 5, 1)];
      const ranking = buildRanking(songs);
      expect(ranking[0].id).toBe(1);
    });
  });

  describe('Scenario: All scores identical – tie-break by created_at', () => {
    it('ranks the song with the earliest created_at first', () => {
      const songs = [
        { id: 2, nome: 'S2', canzone: 'C2', artista: 'A2', created_at: '2025-01-02T00:00:00Z',
          _scores: { sum: 5, count: 1 } },
        { id: 1, nome: 'S1', canzone: 'C1', artista: 'A1', created_at: '2025-01-01T00:00:00Z',
          _scores: { sum: 5, count: 1 } },
      ];
      const ranking = buildRanking(songs);
      expect(ranking[0].id).toBe(1);
    });
  });

  describe('Scenario: Songs without _scores', () => {
    it('treats missing _scores as 0 total, 0 count', () => {
      const s = { id: 1, created_at: '2025-01-01T00:00:00Z' };
      const [ranked] = buildRanking([s]);
      expect(ranked.scoreTotal).toBe(0);
      expect(ranked.scoreCount).toBe(0);
      expect(ranked.scoreAvg).toBe(0);
    });
  });

  describe('Scenario: Single song', () => {
    it('returns that song as the sole ranking entry', () => {
      const ranking = buildRanking([song(1, 10, 2)]);
      expect(ranking).toHaveLength(1);
      expect(ranking[0].id).toBe(1);
    });
  });

  describe('Scenario: Empty songs list', () => {
    it('returns an empty ranking', () => {
      expect(buildRanking([])).toEqual([]);
    });
  });

  describe('Scenario: Winner is identified from vincitore_prenotazione_id', () => {
    /**
     * renderFinalLeaderboard() in vota.html picks the winner as follows:
     *   const winnerId = Number(serata?.vincitore_prenotazione_id) || Number(ranking[0].id);
     *   const winner   = ranking.find(item => Number(item.id) === winnerId) || ranking[0];
     *
     * We test the logic that selects the winner from a given ranking.
     */
    it('selects the song matching vincitore_prenotazione_id as winner', () => {
      const ranking = buildRanking([song(1, 20, 4), song(2, 10, 2), song(3, 5, 1)]);
      const winnerId = 2; // override: not the highest scorer
      const winner = ranking.find(s => Number(s.id) === winnerId) || ranking[0];
      expect(winner.id).toBe(2);
    });

    it('falls back to the top-ranked song when vincitore_prenotazione_id is 0', () => {
      const ranking = buildRanking([song(1, 20, 4), song(2, 10, 2)]);
      const winnerId = Number(0) || Number(ranking[0].id); // 0 is falsy → use ranking[0]
      const winner = ranking.find(s => Number(s.id) === winnerId) || ranking[0];
      expect(winner.id).toBe(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: setDisplayIndexes (chronological display numbering)', () => {

  describe('Scenario: Songs have different timestamps', () => {
    it('assigns index 1 to the earliest song', () => {
      const songs = [
        { id: 1, created_at: '2025-01-03T00:00:00Z' },
        { id: 2, created_at: '2025-01-01T00:00:00Z' },
        { id: 3, created_at: '2025-01-02T00:00:00Z' },
      ];
      setDisplayIndexes(songs);
      expect(songs.find(s => s.id === 2)._displayIndex).toBe(1);
      expect(songs.find(s => s.id === 3)._displayIndex).toBe(2);
      expect(songs.find(s => s.id === 1)._displayIndex).toBe(3);
    });
  });

  describe('Scenario: Same timestamp – tie-break by id ascending', () => {
    it('assigns lower index to the song with the smaller id', () => {
      const ts = '2025-01-01T00:00:00Z';
      const songs = [{ id: 3, created_at: ts }, { id: 1, created_at: ts }, { id: 2, created_at: ts }];
      setDisplayIndexes(songs);
      expect(songs.find(s => s.id === 1)._displayIndex).toBe(1);
      expect(songs.find(s => s.id === 2)._displayIndex).toBe(2);
      expect(songs.find(s => s.id === 3)._displayIndex).toBe(3);
    });
  });

  describe('Scenario: Original display order is preserved', () => {
    it('does not reorder the songs array', () => {
      const songs = [
        { id: 2, created_at: '2025-01-02T00:00:00Z' },
        { id: 1, created_at: '2025-01-01T00:00:00Z' },
      ];
      setDisplayIndexes(songs);
      expect(songs[0].id).toBe(2);
      expect(songs[1].id).toBe(1);
    });
  });
});
