// Caption Battle: the two-stage engine's flagship. Stage two's content is
// built out of stage one's submissions; scoring is votes received, with the
// vote budget spread across several picks so mid-tier entries separate from
// zero instead of the whole room tying at the floor.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { ENTRY_MAX_CHARS } from '../shared/textclean.js';
import { buildStageTwo, aggregateGame, votesForPool, formatRaw } from '../server/games.js';

const rng = () => seededRng('caption-test');
const stageOne = { prompt: 'A terrible name for a team offsite:' };

function build(texts) {
  const entries = texts.map((text, i) => ({ playerId: `p${i}`, payload: { text } }));
  return { entries, built: buildStageTwo('caption', entries, { rng: rng(), clientData: stageOne }) };
}

// Cast ballots by AUTHOR name rather than entry id, so tests read the way the
// game plays and never depend on the shuffled pool order.
function ballot(built, voterId, authorIds) {
  const idFor = (author) =>
    Object.keys(built.secret.owners).find((id) => built.secret.owners[id] === author);
  return { playerId: voterId, payload: { votes: authorIds.map(idFor) } };
}

const score = (built, ballots) =>
  aggregateGame('caption', ballots, { clientData: built.clientData, secret: built.secret });

test('stage two is built from stage one, anonymized, with authorship server-side', () => {
  const { built } = build(['Mandatory Fun Island', 'Trust Fall Springs', 'Q3 Vibes Retreat']);
  assert.equal(built.clientData.entries.length, 3);
  assert.equal(built.clientData.prompt, stageOne.prompt);
  // The pool the players see carries text and an opaque id — nothing else.
  for (const e of built.clientData.entries) {
    assert.deepEqual(Object.keys(e).sort(), ['id', 'text']);
  }
  const json = JSON.stringify(built.clientData);
  assert.ok(!/p0|p1|p2/.test(json), 'no playerId leaks into the broadcast pool');
  assert.deepEqual(Object.values(built.secret.owners).sort(), ['p0', 'p1', 'p2']);
});

test('stage two content is moderated on the way into the pool', () => {
  const { built } = build([
    'line\none\ttwo',
    'x'.repeat(ENTRY_MAX_CHARS + 30),
    'bidi‮flip‬ here',
  ]);
  const texts = built.clientData.entries.map((e) => e.text);
  assert.ok(texts.includes('line one two'), 'newlines and tabs never reach the projector');
  assert.ok(texts.some((t) => [...t].length === ENTRY_MAX_CHARS), 'length is capped');
  assert.ok(texts.includes('bidiflip here'), 'bidi overrides are stripped');
});

test('blank and whitespace-only submissions never enter the pool', () => {
  const { built } = build(['   ', 'real answer', '\n\n', 'another real one']);
  assert.equal(built.clientData.entries.length, 2);
});

test('vote budget scales with the pool and never exceeds the non-self entries', () => {
  assert.equal(votesForPool(2), 1, 'two entries: you can only vote for the other one');
  assert.equal(votesForPool(3), 2);
  assert.equal(votesForPool(4), 3);
  assert.equal(votesForPool(20), 3, 'capped at three picks');
  assert.equal(build(['a', 'b']).built.clientData.votesPerPlayer, 1);
  assert.equal(build(['a', 'b', 'c', 'd', 'e']).built.clientData.votesPerPlayer, 3);
});

test('score is votes received; every author is scored, voters-only are not', () => {
  const { built } = build(['a', 'b', 'c', 'd']);
  const { metrics, extra } = score(built, [
    ballot(built, 'p0', ['p1', 'p2', 'p3']),
    ballot(built, 'p1', ['p2', 'p3']),          // spending fewer than the budget is fine
    ballot(built, 'p2', ['p3']),
    // A player who joined between the stages: votes, but wrote nothing.
    ballot(built, 'latecomer', ['p3']),
  ]);
  assert.equal(metrics.get('p0'), 0, 'an author nobody voted for still scores, at zero');
  assert.equal(metrics.get('p1'), 1);
  assert.equal(metrics.get('p2'), 2);
  assert.equal(metrics.get('p3'), 4);
  assert.equal(metrics.has('latecomer'), false, 'voting alone is not a submission');
  assert.equal(extra.voters, 4);
  assert.equal(extra.board[0].playerId, 'p3', 'board sorted by votes, most first');
  assert.equal(formatRaw('caption', 1, {}), '1 vote');
  assert.equal(formatRaw('caption', 3, {}), '3 votes');
  assert.equal(formatRaw('caption', null, { votes: ['e0'] }), 'voted — no caption');
  assert.equal(formatRaw('caption', null, {}), 'no submission');
});

test('self-votes are rejected server-side by playerId, whatever the client sends', () => {
  const { built } = build(['a', 'b', 'c', 'd']);
  const { metrics } = score(built, [
    ballot(built, 'p0', ['p0', 'p0', 'p0']),   // all three picks spent on itself
    ballot(built, 'p1', ['p0', 'p1', 'p2']),   // one self-vote smuggled in
  ]);
  assert.equal(metrics.get('p0'), 1, 'only p1’s honest vote lands on p0');
  assert.equal(metrics.get('p1'), 0, 'a self-vote is worth nothing');
  assert.equal(metrics.get('p2'), 1);
});

test('ballots are capped, deduped, and stripped of unknown ids', () => {
  const { built } = build(['a', 'b', 'c', 'd', 'e']);
  const ids = built.clientData.entries.map((e) => e.id);
  const stuffed = { playerId: 'p0', payload: { votes: [ids[1], ids[1], ids[2], ids[3], ids[4], 'nope', 42, null] } };
  const { metrics } = score(built, [stuffed]);
  const landed = [...metrics.values()].reduce((a, b) => a + b, 0);
  assert.equal(landed, 3, 'three picks, no more: duplicates and junk ids dropped');
  assert.equal(metrics.get(built.secret.owners[ids[1]]), 1, 'a duplicated pick counts once');
});

test('a malformed ballot scores its author zero instead of throwing', () => {
  const { built } = build(['a', 'b', 'c']);
  for (const payload of [null, undefined, {}, { votes: 'nope' }, { votes: [] }]) {
    const { metrics, extra } = score(built, [{ playerId: 'p0', payload }]);
    assert.equal([...metrics.values()].reduce((a, b) => a + b, 0), 0);
    assert.equal(extra.voters, 0);
  }
});

test('a hidden entry is voided: no votes count, its author scores zero', () => {
  const { built } = build(['a', 'b', 'c', 'd']);
  const hiddenId = Object.keys(built.secret.owners).find((id) => built.secret.owners[id] === 'p1');
  built.clientData.hidden = [hiddenId];
  const { metrics, extra } = score(built, [
    ballot(built, 'p0', ['p1', 'p2', 'p3']),
    ballot(built, 'p2', ['p1', 'p3', 'p0']),
  ]);
  assert.equal(metrics.get('p1'), 0, 'votes for a pulled entry are voided');
  assert.equal(metrics.get('p3'), 2, 'the rest of the ballot still counts');
  assert.equal(extra.board.find((r) => r.playerId === 'p1').hidden, true);
});

test('degenerate pools: nobody wrote anything, or only one player did', () => {
  assert.equal(buildStageTwo('caption', [], { rng: rng(), clientData: stageOne }), null,
    '0 submissions: there is no second stage to run');
  const solo = [{ playerId: 'p0', payload: { text: 'the only answer' } }];
  assert.equal(buildStageTwo('caption', solo, { rng: rng(), clientData: stageOne }), null,
    '1 submission: nothing to choose between');

  // With stage two skipped the caller aggregates stage one instead — the lone
  // author is still scored, and everyone else is a non-submitter.
  const none = aggregateGame('caption', [], { clientData: stageOne, secret: {} });
  assert.equal(none.metrics.size, 0);
  assert.equal(none.extra.skipped, true);

  const one = aggregateGame('caption', solo, { clientData: stageOne, secret: {} });
  assert.equal(one.metrics.get('p0'), 0, 'wrote something, received no votes');
  assert.equal(one.extra.board.length, 1);
  assert.equal(one.extra.board[0].text, 'the only answer');
});

test('two players: each can only vote for the other, and both are scored', () => {
  const { built } = build(['anna answer', 'ben answer']);
  assert.equal(built.clientData.votesPerPlayer, 1);
  const { metrics } = score(built, [
    ballot(built, 'p0', ['p1']),
    ballot(built, 'p1', ['p0']),
  ]);
  assert.equal(metrics.get('p0'), 1);
  assert.equal(metrics.get('p1'), 1);
});

test('the pool shuffle is seeded — identical for every player, stable per round', () => {
  const texts = ['a', 'b', 'c', 'd', 'e', 'f'];
  const entries = texts.map((text, i) => ({ playerId: `p${i}`, payload: { text } }));
  const once = buildStageTwo('caption', entries, { rng: rng(), clientData: stageOne });
  const twice = buildStageTwo('caption', entries, { rng: rng(), clientData: stageOne });
  assert.deepEqual(once.clientData.entries, twice.clientData.entries);
  const different = buildStageTwo('caption', entries, { rng: seededRng('other'), clientData: stageOne });
  assert.notDeepEqual(once.clientData.entries, different.clientData.entries);
});
