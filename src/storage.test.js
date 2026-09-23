import test from 'node:test';
import assert from 'node:assert/strict';

import {
  safeReadStorage,
  safeWriteStorage,
  createDefaultTeam,
  getUserScopedStorageKey,
} from './storage.js';

test('safeReadStorage returns null when storage throws', () => {
  const originalLocalStorage = globalThis.localStorage;

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem() {
        throw new Error('QuotaExceededError');
      },
    },
  });

  try {
    assert.equal(safeReadStorage('challenge100-team'), null);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});

test('safeWriteStorage captures storage failures without crashing', () => {
  const originalLocalStorage = globalThis.localStorage;

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      setItem() {
        throw new Error('SecurityError');
      },
    },
  });

  try {
    assert.doesNotThrow(() => safeWriteStorage('challenge100-team', { ok: true }));
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});

test('createDefaultTeam returns a valid default team', () => {
  const team = createDefaultTeam();

  assert.ok(team.selectedId);
  assert.equal(team.participants.length, 5);
  assert.equal(team.participants[0].days.length, 100);
});

test('user-scoped local storage keys stay isolated per local user', () => {
  const firstKey = getUserScopedStorageKey('challenge100-team');
  const secondKey = getUserScopedStorageKey('challenge100-team', 'other-user');

  assert.notEqual(firstKey, secondKey);
  assert.match(firstKey, /^challenge100-team:/);
  assert.match(secondKey, /^challenge100-team:other-user$/);
});
