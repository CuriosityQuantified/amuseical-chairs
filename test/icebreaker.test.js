// Icebreaker: the variable-length multi-stage game. Stage 1 collects one true
// fun fact per player; stages 2…N+1 serve those facts back ONE at a time, in
// the same order on every screen, with the whole room as the candidate list.
// Scoring is correct guesses, summed across every guessing stage.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { ENTRY_MAX_CHARS } from '../shared/textclean.js';
import { buildStages, buildReveal, aggregateGame, formatRaw } from '../server/games.js';

const rng = () => seededRng('icebreaker-test');
const stageOne = { prompt: 'A fun fact about you that nobody in this room knows:' };

const PLAYERS = ['Anna', 'Ben', 'Cat', 'Dev'].map((name, i) => ({ id: `p${i}`, name }));

// Everyone writes a fact unless `texts` says otherwise (index-aligned with
// PLAYERS; null = never submitted).
function facts(texts, players = PLAYERS, seeded = rng()) {
  const entries = texts
    .map((text, i) => (text == null ? null : { playerId: players[i].id, payload: { text } }))
    .filter(Boolean);
  return { entries, stages: buildStages('icebreaker', entries, { rng: seeded, clientData: stageOne, players }) };
}

// Play a whole game: `picks` is [{ playerId -> authorId }] per guessing stage,
// in the stage order the server chose. Returns the flattened stage history the
// room hands to games.js.
function play(built, entries, picks) {
  const history = [{ stage: 1, clientData: stageOne, secret: {}, entries }];
  built.forEach((s, i) => {
    history.push({
      stage: i + 2,
      clientData: s.clientData,
      secret: s.secret,
      entries: Object.entries(picks[i] || {}).map(([playerId, pick]) => ({
        playerId,
        payload: pick == null ? {} : { factId: s.clientData.factId, pick },
      })),
    });
  });
  return history;
}

// The stage index whose fact belongs to `authorId` — tests should never depend
// on the shuffled fact order.
const stageOf = (built, authorId) => built.findIndex((s) => s.secret.answer === authorId);

test('one guessing stage per fun fact, in one order the whole room shares', () => {
  const { stages } = facts(['anna fact', 'ben fact', 'cat fact', 'dev fact']);
  assert.equal(stages.length, 4, 'four facts, four guessing stages');
  assert.deepEqual(stages.map((s) => s.clientData.round), [1, 2, 3, 4]);
  assert.ok(stages.every((s) => s.clientData.totalRounds === 4));
  assert.ok(stages.every((s) => s.reveal), 'every fact stops for a reveal before the next one');
  assert.deepEqual(stages.map((s) => s.clientData.factId), ['f0', 'f1', 'f2', 'f3']);
  // Every fact belongs to a different player and all four are on the list.
  assert.deepEqual(stages.map((s) => s.secret.answer).sort(), ['p0', 'p1', 'p2', 'p3']);
  // Nobody is served a fact before the room has finished with the one before.
  assert.deepEqual(stages.map((s) => s.stageName),
    ['Fun fact 1 of 4', 'Fun fact 2 of 4', 'Fun fact 3 of 4', 'Fun fact 4 of 4']);
});

test('the fact order is seeded — identical for every player, stable per round', () => {
  const texts = ['a fact', 'b fact', 'c fact', 'd fact'];
  const once = facts(texts).stages;
  const twice = facts(texts).stages;
  assert.deepEqual(once.map((s) => s.clientData.text), twice.map((s) => s.clientData.text));
  assert.deepEqual(once.map((s) => s.clientData.options), twice.map((s) => s.clientData.options));
  const other = facts(texts, PLAYERS, seededRng('a different room')).stages;
  assert.notDeepEqual(once.map((s) => s.clientData.text), other.map((s) => s.clientData.text));
});

test('every player is an option on every fact, in the same order throughout', () => {
  // Cat never wrote a fact and Dev is the author of one — both are still
  // pickable for every fact, and so is the guesser themselves.
  const { stages } = facts(['anna fact', 'ben fact', null, 'dev fact']);
  assert.equal(stages.length, 3, 'three facts written, three guessing stages');
  const first = stages[0].clientData.options;
  assert.equal(first.length, 4, 'the candidate list is the whole room, not just the authors');
  assert.deepEqual([...first].map((o) => o.name).sort(), ['Anna', 'Ben', 'Cat', 'Dev']);
  for (const s of stages) {
    assert.deepEqual(s.clientData.options, first,
      'the same names in the same order on every fact — nothing moves under a thumb');
  }
});

test('the broadcast fact never carries who wrote it', () => {
  const { stages } = facts(['anna fact', 'ben fact', 'cat fact', 'dev fact']);
  for (const s of stages) {
    assert.deepEqual(Object.keys(s.clientData).sort(),
      ['factId', 'hidden', 'options', 'round', 'text', 'totalRounds']);
    assert.equal(typeof s.secret.answer, 'string', 'authorship stays server-side');
  }
});

test('fun facts are moderated on the way onto the projector', () => {
  const { stages } = facts([
    'line\none\ttwo',
    'x'.repeat(ENTRY_MAX_CHARS + 30),
    'bidi‮flip‬ here',
    '   ',
  ]);
  const texts = stages.map((s) => s.clientData.text);
  assert.equal(stages.length, 3, 'a whitespace-only fact never becomes a round');
  assert.ok(texts.includes('line one two'), 'newlines and tabs never reach the projector');
  assert.ok(texts.some((t) => [...t].length === ENTRY_MAX_CHARS), 'length is capped');
  assert.ok(texts.includes('bidiflip here'), 'bidi overrides are stripped');
});

test('scoring: one point per fact matched to the right person', () => {
  const { entries, stages } = facts(['anna fact', 'ben fact', 'cat fact', 'dev fact']);
  const authors = ['p0', 'p1', 'p2', 'p3'];
  // Anna gets every fact right; Ben gets one; Cat guesses herself every time
  // (legal, and right exactly once); Dev never guesses at all.
  const picks = stages.map((s) => {
    const answer = s.secret.answer;
    return {
      p0: answer,
      p1: answer === authors[0] ? answer : 'p0',
      p2: 'p2',
    };
  });
  const { metrics, extra } = aggregateGame('icebreaker', [], { stages: play(stages, entries, picks) });
  assert.equal(metrics.get('p0'), 4, 'four for four');
  assert.equal(metrics.get('p1'), 1);
  assert.equal(metrics.get('p2'), 1, 'the same name can be picked every round; only the right one scores');
  assert.equal(metrics.get('p3'), 0, 'wrote a fact but never guessed — scored, at zero');
  assert.equal(extra.facts, 4);
  assert.equal(extra.skipped, false);
  assert.equal(formatRaw('icebreaker', 4), '4 right');
  assert.equal(formatRaw('icebreaker', null), 'no submission');
});

test('your own fact is a point everyone in the room gets exactly one of', () => {
  const { entries, stages } = facts(['anna fact', 'ben fact', 'cat fact', 'dev fact']);
  // Everybody plays the same strategy: pick yourself, every time.
  const picks = stages.map(() => ({ p0: 'p0', p1: 'p1', p2: 'p2', p3: 'p3' }));
  const { metrics } = aggregateGame('icebreaker', [], { stages: play(stages, entries, picks) });
  for (const id of ['p0', 'p1', 'p2', 'p3']) {
    assert.equal(metrics.get(id), 1, `${id} banked their own fact and nothing else`);
  }
});

test('a player who never wrote and never guessed is a non-submitter', () => {
  const { entries, stages } = facts(['anna fact', 'ben fact', 'cat fact', null]);
  const picks = stages.map((s) => ({ p0: s.secret.answer }));
  const { metrics } = aggregateGame('icebreaker', [], { stages: play(stages, entries, picks) });
  assert.equal(metrics.get('p0'), 3);
  assert.equal(metrics.get('p1'), 0, 'wrote a fact');
  assert.equal(metrics.get('p2'), 0, 'wrote a fact');
  assert.equal(metrics.has('p3'), false, 'did neither — scores 0 for the game as a non-submission');
});

test('garbage guesses are dropped, not counted', () => {
  const { entries, stages } = facts(['anna fact', 'ben fact', 'cat fact', 'dev fact']);
  const history = play(stages, entries, stages.map(() => ({})));
  // A hand-rolled client sending nonsense for every fact.
  for (const s of history.slice(1)) {
    s.entries = [
      { playerId: 'p0', payload: { pick: 42 } },
      { playerId: 'p1', payload: { pick: 'nobody-by-that-id' } },
      { playerId: 'p2', payload: {} },
      { playerId: 'p3', payload: null },
    ];
  }
  const { metrics } = aggregateGame('icebreaker', [], { stages: history });
  for (const id of ['p0', 'p1', 'p2', 'p3']) assert.equal(metrics.get(id), 0);
});

test('a fact the host pulled scores nobody, and never reappears', () => {
  const { entries, stages } = facts(['anna fact', 'ben fact', 'cat fact', 'dev fact']);
  const picks = stages.map((s) => ({ p0: s.secret.answer, p1: s.secret.answer }));
  const history = play(stages, entries, picks);
  // The host pulled the second fact mid-stage: text gone, hidden set.
  const pulled = history[2];
  pulled.clientData = { ...pulled.clientData, hidden: true, text: '' };

  const { metrics, extra } = aggregateGame('icebreaker', [], { stages: history });
  assert.equal(metrics.get('p0'), 3, 'the pulled fact is voided — right or wrong');
  assert.equal(metrics.get('p1'), 3);
  const row = extra.rounds.find((r) => r.hidden);
  assert.equal(row.text, '', 'nothing downstream can render what was pulled');
  assert.equal(row.playerId, null, 'and it does not out its author either');
  assert.equal(row.rightCount, 0);
});

test('degenerate rooms: nobody wrote a fact, or only one player did', () => {
  assert.equal(facts([null, null, null, null]).stages, null,
    '0 facts: there is nothing to guess between');
  const solo = facts(['the only fact in the room', null, null, null]);
  assert.equal(solo.stages, null, '1 fact: everyone would be guessing the same person');

  // With the guessing skipped the caller aggregates stage one instead — the
  // lone author is still scored, and everyone else is a non-submitter.
  const none = aggregateGame('icebreaker', [], {
    stages: [{ stage: 1, clientData: stageOne, secret: {}, entries: [] }],
  });
  assert.equal(none.metrics.size, 0);
  assert.equal(none.extra.skipped, true);
  assert.equal(none.extra.facts, 0);

  const one = aggregateGame('icebreaker', [], {
    stages: [{ stage: 1, clientData: stageOne, secret: {}, entries: solo.entries }],
  });
  assert.equal(one.metrics.get('p0'), 0, 'wrote something, guessed nothing');
  assert.equal(one.extra.skipped, true);
});

test('two players is enough to play', () => {
  const duo = [{ id: 'p0', name: 'Anna' }, { id: 'p1', name: 'Ben' }];
  const { stages } = facts(['anna fact', 'ben fact'], duo);
  assert.equal(stages.length, 2);
  assert.ok(stages.every((s) => s.clientData.options.length === 2));
});

test('the reveal holds the answer back until the host asks for it', () => {
  const { entries, stages } = facts(['anna fact', 'ben fact', 'cat fact', 'dev fact']);
  const annas = stageOf(stages, 'p0');
  const picks = stages.map((s, i) => (i === annas
    ? { p1: 'p0', p2: 'p0', p3: 'p2' }   // Ben and Cat get Anna's; Dev says Cat
    : { p1: s.secret.answer }));
  const history = play(stages, entries, picks).slice(0, annas + 2);

  const { teaser, answer } = buildReveal('icebreaker', history);
  // The teaser goes to every device the moment the fact closes. A player
  // reading their own socket must not be able to find the answer in it.
  assert.equal(teaser.guessed, 3, 'the room is told how many locked in, and no more');
  assert.equal(JSON.stringify(teaser).includes('p0'), false, 'no author, no ballots, no answer');
  assert.equal(teaser.text, 'anna fact');

  assert.equal(answer.playerId, 'p0', 'the host press is what reveals it');
  assert.deepEqual(answer.tally, [{ playerId: 'p0', count: 2 }, { playerId: 'p2', count: 1 }],
    'most-guessed first — the shape of the argument the room just had');
  const ben = answer.guesses.find((g) => g.playerId === 'p1');
  assert.equal(ben.correct, true);
  assert.equal(ben.pickedId, 'p0');
  assert.equal(answer.guesses.find((g) => g.playerId === 'p3').correct, false);
});

test('the reveal carries each player their own running count', () => {
  const { entries, stages } = facts(['anna fact', 'ben fact', 'cat fact', 'dev fact']);
  const picks = stages.map((s) => ({ p0: s.secret.answer, p1: 'p1' }));
  const full = play(stages, entries, picks);
  const runs = [];
  for (let upTo = 2; upTo <= full.length; upTo++) {
    const { answer } = buildReveal('icebreaker', full.slice(0, upTo));
    runs.push(answer.guesses.find((g) => g.playerId === 'p0').rightSoFar);
  }
  assert.deepEqual(runs, [1, 2, 3, 4], 'it counts up across the facts already played');
});

test('a pulled fact reveals as pulled, with no answer at all', () => {
  const { entries, stages } = facts(['anna fact', 'ben fact', 'cat fact', 'dev fact']);
  const history = play(stages, entries, [{ p1: 'p0' }]).slice(0, 2);
  history[1].clientData = { ...history[1].clientData, hidden: true, text: '' };
  const { teaser, answer } = buildReveal('icebreaker', history);
  assert.equal(teaser.hidden, true);
  assert.equal(answer.hidden, true);
  assert.equal(answer.playerId, null);
  assert.equal(answer.text, '');
});

test('there is no reveal to build before the first fact has been played', () => {
  assert.equal(buildReveal('icebreaker', [{ stage: 1, clientData: stageOne, secret: {}, entries: [] }]), null);
  assert.equal(buildReveal('icebreaker', []), null);
  assert.equal(buildReveal('caption', []), null, 'only Icebreaker stops between stages');
});
