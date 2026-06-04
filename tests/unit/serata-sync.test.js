// @vitest-environment jsdom
/**
 * tests/unit/serata-sync.test.js
 *
 * Unit tests for scripts/serata-sync.js (window.createSerataSync).
 *
 * createSerataSync implements the "realtime-first with guaranteed poll"
 * strategy: it subscribes to Supabase realtime postgres_changes for the
 * configured tables and also keeps a fallback poll. Both realtime events and
 * the poll trigger the same sync cycle (fetchState -> onChange). It manages the
 * channel lifecycle (removeChannel before re-subscribing) and coalesces
 * overlapping syncs.
 *
 * These tests use fake timers and a fake Supabase client.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let createSerataSync;

// ── Fake Supabase realtime client ────────────────────────────────────────────
function makeFakeDb() {
  const handlers = [];
  const channels = [];
  const removed = [];
  const db = {
    channel(name) {
      const ch = {
        name,
        _subscribed: false,
        on(_event, filter, cb) {
          handlers.push({ table: filter && filter.table, cb });
          return ch;
        },
        subscribe(statusCb) {
          ch._subscribed = true;
          if (statusCb) statusCb('SUBSCRIBED');
          return ch;
        },
      };
      channels.push(ch);
      return ch;
    },
    removeChannel(ch) {
      removed.push(ch);
    },
    // test helper: simulate a realtime event for a table
    emit(table, payload = { eventType: 'UPDATE' }) {
      handlers
        .filter((h) => h.table === table)
        .forEach((h) => h.cb(payload));
    },
    _channels: channels,
    _removed: removed,
  };
  return db;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  delete window.createSerataSync;
  await import('../../scripts/serata-sync.js');
  createSerataSync = window.createSerataSync;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSerataSync – lifecycle', () => {
  it('runs an initial sync on start', async () => {
    const onChange = vi.fn();
    const fetchState = vi.fn(async () => ({ open: true }));
    const sync = createSerataSync({ db: makeFakeDb(), fetchState, onChange, pollMs: 0 });
    sync.start();
    await vi.runOnlyPendingTimersAsync();
    expect(fetchState).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ open: true });
    sync.stop();
  });

  it('subscribes to a channel for each configured table', () => {
    const db = makeFakeDb();
    const sync = createSerataSync({
      db,
      tables: ['serate', 'prenotazioni'],
      onChange: vi.fn(),
      pollMs: 0,
    });
    sync.start();
    expect(db._channels.length).toBe(1);
    expect(db._channels[0]._subscribed).toBe(true);
    sync.stop();
  });

  it('removes the channel on stop', () => {
    const db = makeFakeDb();
    const sync = createSerataSync({ db, onChange: vi.fn(), pollMs: 0 });
    sync.start();
    sync.stop();
    expect(db._removed.length).toBe(1);
  });

  it('does not start twice', () => {
    const db = makeFakeDb();
    const sync = createSerataSync({ db, onChange: vi.fn(), pollMs: 0 });
    sync.start();
    sync.start();
    expect(db._channels.length).toBe(1);
    sync.stop();
  });
});

describe('createSerataSync – polling fallback', () => {
  it('runs sync on each poll interval when pollMs > 0', async () => {
    const onChange = vi.fn();
    const sync = createSerataSync({ db: makeFakeDb(), onChange, pollMs: 8000, debounceMs: 0 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0); // initial
    expect(onChange).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(8000);
    expect(onChange).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(8000);
    expect(onChange).toHaveBeenCalledTimes(3);
    sync.stop();
  });

  it('does not poll when pollMs === 0 (realtime only)', async () => {
    const onChange = vi.fn();
    const sync = createSerataSync({ db: makeFakeDb(), onChange, pollMs: 0 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0); // initial only
    expect(onChange).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(onChange).toHaveBeenCalledTimes(1);
    sync.stop();
  });

  it('stops polling after stop()', async () => {
    const onChange = vi.fn();
    const sync = createSerataSync({ db: makeFakeDb(), onChange, pollMs: 1000, debounceMs: 0 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    sync.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('createSerataSync – realtime events', () => {
  it('schedules a debounced sync on a realtime event', async () => {
    const db = makeFakeDb();
    const onChange = vi.fn();
    const sync = createSerataSync({ db, tables: ['serate'], onChange, pollMs: 0, debounceMs: 150 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0); // initial sync (1)
    db.emit('serate');
    expect(onChange).toHaveBeenCalledTimes(1); // not yet, debounced
    await vi.advanceTimersByTimeAsync(150);
    expect(onChange).toHaveBeenCalledTimes(2);
    sync.stop();
  });

  it('coalesces a burst of realtime events into a single sync', async () => {
    const db = makeFakeDb();
    const onChange = vi.fn();
    const sync = createSerataSync({ db, tables: ['serate'], onChange, pollMs: 0, debounceMs: 150 });
    sync.start();
    await vi.runOnlyPendingTimersAsync();
    db.emit('serate');
    db.emit('serate');
    db.emit('serate');
    await vi.advanceTimersByTimeAsync(150);
    expect(onChange).toHaveBeenCalledTimes(2); // 1 initial + 1 coalesced
    sync.stop();
  });

  it('ignores events for tables it is not subscribed to', async () => {
    const db = makeFakeDb();
    const onChange = vi.fn();
    const sync = createSerataSync({ db, tables: ['serate'], onChange, pollMs: 0, debounceMs: 150 });
    sync.start();
    await vi.runOnlyPendingTimersAsync();
    db.emit('prenotazioni');
    await vi.advanceTimersByTimeAsync(150);
    expect(onChange).toHaveBeenCalledTimes(1);
    sync.stop();
  });
});

describe('createSerataSync – errors and coalescing', () => {
  it('reports fetchState errors through onError without throwing', async () => {
    const onError = vi.fn();
    const onChange = vi.fn();
    const fetchState = vi.fn(async () => { throw new Error('boom'); });
    const sync = createSerataSync({ db: makeFakeDb(), fetchState, onChange, onError, pollMs: 0 });
    sync.start();
    await vi.runOnlyPendingTimersAsync();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onChange).not.toHaveBeenCalled();
    sync.stop();
  });

  it('runs at most one queued sync while another is in flight', async () => {
    const db = makeFakeDb();
    let resolveFirst;
    const fetchState = vi.fn(() => new Promise((res) => { resolveFirst = res; }));
    const onChange = vi.fn();
    const sync = createSerataSync({ db, fetchState, onChange, pollMs: 0, debounceMs: 0 });
    sync.start(); // initial sync starts but blocks on fetchState
    expect(fetchState).toHaveBeenCalledTimes(1);
    // While in-flight, queue several more
    sync.refresh();
    sync.refresh();
    sync.refresh();
    expect(fetchState).toHaveBeenCalledTimes(1);
    resolveFirst({ open: true });
    await vi.runOnlyPendingTimersAsync();
    // Exactly one queued run should have followed the in-flight one
    expect(fetchState).toHaveBeenCalledTimes(2);
    sync.stop();
  });

  it('works without a db (poll-only mode)', async () => {
    const onChange = vi.fn();
    const sync = createSerataSync({ db: null, onChange, pollMs: 1000, debounceMs: 0 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2);
    sync.stop();
  });
});
