import test from 'node:test';
import assert from 'node:assert/strict';
import { CODE_ALPHABET, normalizeRoomCode } from '../shared/room-code.js';
import { makeRoomCode } from '../server/room.js';

test('room-code alphabet is canonical and generated codes use it', () => {
  assert.equal(CODE_ALPHABET, 'ABCDEFGHJKLMNPQRSTUVWXYZ');
  assert.match(makeRoomCode(() => 0), /^[A-HJ-NP-Z]{4}$/);
  assert.match(makeRoomCode(() => 0.99), /^[A-HJ-NP-Z]{4}$/);
});

test('room-code normalization accepts lowercase canonical values', () => {
  assert.equal(normalizeRoomCode(' abcd '), 'ABCD');
});

test('room-code normalization rejects invalid four-character values', () => {
  for (const value of ['!!!!', '1234', 'AB CD', 'ABCI', 'ABCO']) {
    assert.equal(normalizeRoomCode(value), null, `${value} must be rejected`);
  }
});
