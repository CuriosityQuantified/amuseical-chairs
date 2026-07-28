// Room-level integration for multi-stage games: collect from everyone
// simultaneously → build the stages that follow out of the pool → collect
// from everyone simultaneously again → aggregate and score. Every stage is
// played by all players at once; nothing here is turn-based.
//
// Caption Battle has exactly two stages. Icebreaker's length depends on what
// the room wrote (one guessing stage per fun fact) and it stops between them
// for a host-driven reveal — the second half of this file is that engine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/room.js';
import { ROSTER } from '../server/games.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A stub io that records what was broadcast, so tests can assert on the phase
// payloads the clients would actually have received.
function recordingIo() {
  const events = [];
  return {
    events,
    to: (room) => ({ emit: (event, data) => events.push({ room, event, data }) }),
  };
}

async function waitFor(fn, ms = 5000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return;
    await sleep(15);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function addPlayer(room, id, name) {
  room.players.set(id, {
    id, name, socketId: `sock-${id}`, connected: true,
    disconnectedAt: null, sync: null, joinedAt: Date.now(),
  });
}

function onlyGames(...keys) {
  const enabled = {};
  for (const g of ROSTER) enabled[g.key] = keys.includes(g.key);
  return enabled;
}

const FAST = {
  practice: false, gameDuration: 400, musicMs: 40, tutorialMs: 0,
  redemptionPrepMs: 60, redemptionLeadMs: 120,
  postGreenTimeout: 600, hardTimeout: 1200, closeGraceMs: 150,
};

// Boot a caption-only room with `names.length` players, parked on stage one.
async function captionRoom(names, config = {}) {
  const io = recordingIo();
  const room = new Room(io, 'TWOS', { ...FAST, ...config, enabled: onlyGames('caption') });
  names.forEach((name, i) => addPlayer(room, `p${i + 1}`, name));
  assert.equal(room.start().ok, true);
  await waitFor(() => room.phase === 'minigame', 3000, 'stage one');
  return { room, io };
}

const stageOf = (room) => room.round.games[room.round.gameIndex];
const phasePayloads = (io) => io.events.filter((e) => e.event === 'phase').map((e) => e.data);

// Vote by author, so tests never depend on the shuffled pool order.
function voteFor(room, voterId, authorIds) {
  const g = stageOf(room);
  const ids = authorIds.map((author) =>
    Object.keys(g.secret.owners).find((id) => g.secret.owners[id] === author));
  room.handleSubmit(voterId, { votes: ids });
  return ids;
}

test('full two-stage game: pool built from stage one, scored on stage two', async () => {
  const { room, io } = await captionRoom(['Anna', 'Ben', 'Cat', 'Dev']);
  try {
    const one = stageOf(room);
    assert.equal(one.stage, 1);
    assert.equal(one.totalStages, 2);
    assert.ok(one.clientData.prompt, 'stage one carries a seeded prompt');

    room.handleSubmit('p1', { text: 'Mandatory Fun Island' });
    room.handleSubmit('p2', { text: 'Trust Fall Springs' });
    room.handleSubmit('p3', { text: 'Q3 Vibes Retreat' });
    room.handleSubmit('p4', { text: 'Synergy Cove' });

    // Everyone submitted, so stage one closes immediately — and the phase does
    // not become `scores`: it re-enters `minigame` as stage two.
    await waitFor(() => stageOf(room).stage === 2, 3000, 'stage two');
    assert.equal(room.phase, 'minigame');
    const two = stageOf(room);
    assert.equal(two.clientData.entries.length, 4);
    assert.equal(two.clientData.votesPerPlayer, 3);
    assert.notEqual(two.token, one.token, 'stage two gets a fresh token');
    assert.equal(two.submissions.size, 0, 'stage two gets a fresh submissions map');
    assert.ok(two.deadline > one.deadline, 'stage two gets its own deadline');

    // The phase payload labels the stage the way the chairs rounds label rounds.
    const games = phasePayloads(io).filter((p) => p.name === 'minigame');
    assert.deepEqual(games.map((p) => p.stage), [1, 2]);
    assert.ok(games.every((p) => p.totalStages === 2));
    assert.ok(!JSON.stringify(games[1].clientData).includes('p1'),
      'the broadcast pool never carries authorship');

    voteFor(room, 'p1', ['p2', 'p3', 'p4']);
    voteFor(room, 'p2', ['p4']);
    voteFor(room, 'p3', ['p4']);
    voteFor(room, 'p4', ['p3']);

    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('p1').raw, '0 votes');
    assert.equal(row('p4').raw, '3 votes');
    assert.equal(row('p4').points, 1000, 'most votes wins the game');
    assert.equal(row('p1').points, 0);

    // One scores phase for the whole two-stage game, and one you:score each.
    assert.equal(phasePayloads(io).filter((p) => p.name === 'scores').length, 1);
    const board = room.round.extras.caption.board;
    assert.equal(board.length, 4);
    assert.equal(board[0].name, 'Dev', 'authorship is revealed only at the reveal');
  } finally {
    room.destroy();
  }
});

test('self-votes are rejected server-side, by playerId — not in the client', async () => {
  const { room } = await captionRoom(['Anna', 'Ben', 'Cat', 'Dev']);
  try {
    for (const id of ['p1', 'p2', 'p3', 'p4']) room.handleSubmit(id, { text: `answer from ${id}` });
    await waitFor(() => stageOf(room).stage === 2, 3000, 'stage two');
    // A hand-rolled client spending its whole ballot on itself.
    voteFor(room, 'p1', ['p1', 'p1', 'p1']);
    voteFor(room, 'p2', ['p1']);
    voteFor(room, 'p3', ['p2']);
    voteFor(room, 'p4', ['p2']);
    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('p1').raw, '1 vote', 'only the honest vote landed on p1');
    assert.equal(row('p2').raw, '2 votes');
  } finally {
    room.destroy();
  }
});

test('0 stage-one submissions: stage two is skipped and everyone scores 0', async () => {
  const { room, io } = await captionRoom(['Anna', 'Ben', 'Cat']);
  try {
    // Nobody types anything — the deadline plus grace closes stage one.
    await waitFor(() => room.phase === 'scores', 4000, 'scores');
    assert.equal(phasePayloads(io).filter((p) => p.name === 'minigame').length, 1,
      'no second stage without a pool to vote on');
    for (const id of ['p1', 'p2', 'p3']) {
      const row = room.lastScores.find((r) => r.id === id);
      assert.equal(row.points, 0);
      assert.equal(row.raw, 'no submission');
    }
    assert.equal(room.round.extras.caption.skipped, true);
    assert.equal(room.round.extras.caption.board.length, 0);
  } finally {
    room.destroy();
  }
});

test('1 stage-one submission: stage two is skipped, the lone author is scored', async () => {
  const { room, io } = await captionRoom(['Anna', 'Ben', 'Cat']);
  try {
    room.handleSubmit('p2', { text: 'the only answer in the room' });
    await waitFor(() => room.phase === 'scores', 4000, 'scores');
    assert.equal(phasePayloads(io).filter((p) => p.name === 'minigame').length, 1,
      'nothing to choose between — no vote is run');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('p2').points, 1000, 'the only player who played it takes the game');
    assert.equal(row('p1').points, 0);
    assert.equal(row('p3').points, 0);
    const board = room.round.extras.caption.board;
    assert.equal(board.length, 1);
    assert.equal(board[0].name, 'Ben');
  } finally {
    room.destroy();
  }
});

test('2 players is enough: each votes for the other and both are scored', async () => {
  const { room } = await captionRoom(['Anna', 'Ben']);
  try {
    room.handleSubmit('p1', { text: 'anna answer' });
    room.handleSubmit('p2', { text: 'ben answer' });
    await waitFor(() => stageOf(room).stage === 2, 3000, 'stage two');
    assert.equal(stageOf(room).clientData.votesPerPlayer, 1,
      'with two entries there is exactly one thing you can vote for');
    voteFor(room, 'p1', ['p2']);
    voteFor(room, 'p2', ['p1']);
    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    for (const id of ['p1', 'p2']) {
      assert.equal(room.lastScores.find((r) => r.id === id).raw, '1 vote');
    }
  } finally {
    room.destroy();
  }
});

test('reconnect between stages: identity, running total, and a clean stage-two landing', async () => {
  const io = recordingIo();
  const room = new Room(io, 'RCON', { ...FAST, enabled: onlyGames('stopclock', 'caption') });
  try {
    ['p1', 'p2', 'p3'].forEach((id, i) => addPlayer(room, id, `Player${i + 1}`));
    // Force a known order so the scored game lands before the two-stage one.
    room.queue = ['stopclock', 'caption'];
    room.queueIndex = 0;
    room.totals = new Map([['p1', 0], ['p2', 0], ['p3', 0]]);
    room.nextGame();

    await waitFor(() => room.phase === 'minigame', 3000, 'game one');
    // Stop the Clock is an error metric — p3 is closest, so p3 banks the most.
    room.handleSubmit('p1', { best: 900 });
    room.handleSubmit('p2', { best: 400 });
    room.handleSubmit('p3', { best: 100 });
    await waitFor(() => room.phase === 'scores', 3000, 'game one scores');
    const bankedBefore = Math.round(room.totals.get('p3'));
    assert.ok(bankedBefore > 0, 'p3 banked points before the two-stage game');

    room.hostNext();
    await waitFor(() => room.phase === 'minigame' && stageOf(room).key === 'caption', 3000, 'stage one');
    room.handleSubmit('p1', { text: 'anna answer' });
    room.handleSubmit('p2', { text: 'ben answer' });
    // p3 misses stage one entirely — this is the player who drops out here.
    await waitFor(() => stageOf(room).stage === 2, 4000, 'stage two');

    // p3 comes back mid-vote with its stored playerId.
    const socket = { id: 'sock-new', join() {}, data: {} };
    const res = room.join(socket, { name: 'ignored', playerId: 'p3' });
    assert.equal(res.ok, true);
    assert.equal(res.playerId, 'p3', 'identity survives the reconnect');
    assert.equal(res.name, 'Player3');
    assert.equal(res.snapshot.you.total, bankedBefore, 'the running total survives too');

    // The snapshot lands them straight on stage two, with the pool.
    assert.equal(res.snapshot.game.key, 'caption');
    assert.equal(res.snapshot.game.stage, 2);
    assert.equal(res.snapshot.game.totalStages, 2);
    assert.equal(res.snapshot.game.clientData.entries.length, 2);

    // They can vote, and they score 0 for the stage they missed.
    voteFor(room, 'p3', ['p1']);
    voteFor(room, 'p1', ['p2']);
    voteFor(room, 'p2', ['p1']);
    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('p3').points, 0, 'missing stage one scores 0 for the game');
    assert.equal(row('p3').raw, 'voted — no caption');
    assert.equal(row('p3').total, bankedBefore, 'and nothing already banked is lost');
    assert.equal(row('p1').raw, '2 votes');
  } finally {
    room.destroy();
  }
});

test('the deadline and its grace apply to each stage independently', async () => {
  const { room } = await captionRoom(['Anna', 'Ben', 'Cat'], { gameDuration: 400, closeGraceMs: 300 });
  try {
    const one = stageOf(room);
    const openedAt = Date.now();
    room.handleSubmit('p1', { text: 'anna answer' });
    room.handleSubmit('p2', { text: 'ben answer' });
    // p3 stays silent, so stage one has to run its own clock out.
    await waitFor(() => stageOf(room).stage === 2, 3000, 'stage two');
    const stageOneMs = Date.now() - openedAt;
    assert.ok(stageOneMs >= 400, `stage one ran its full duration (${stageOneMs}ms)`);

    const two = stageOf(room);
    assert.ok(two.deadline - Date.now() > 200, 'stage two opens a fresh full-length window');

    // A vote inside the grace window, after the deadline has passed, still counts.
    await waitFor(() => Date.now() > two.deadline, 2000, 'stage two deadline');
    voteFor(room, 'p1', ['p2']);
    assert.equal(two.submissions.size, 1, 'closeGraceMs applies to stage two as well');

    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    assert.equal(room.lastScores.find((r) => r.id === 'p2').raw, '1 vote');
    assert.ok(one.closed && two.closed, 'both stages closed exactly once');
  } finally {
    room.destroy();
  }
});

test('host can pull an entry off every screen; its votes are voided', async () => {
  const { room, io } = await captionRoom(['Anna', 'Ben', 'Cat', 'Dev']);
  try {
    for (const id of ['p1', 'p2', 'p3', 'p4']) room.handleSubmit(id, { text: `answer from ${id}` });
    await waitFor(() => stageOf(room).stage === 2, 3000, 'stage two');
    const g = stageOf(room);
    const bensId = Object.keys(g.secret.owners).find((id) => g.secret.owners[id] === 'p2');

    assert.equal(room.hideEntry('nope').error, 'Unknown entry.');
    const hid = room.hideEntry(bensId);
    assert.deepEqual(hid.hidden, [bensId]);
    // Every screen is told immediately — there is no undo on a projector.
    const update = io.events.filter((e) => e.event === 'game:data').pop();
    assert.equal(update.room, `room:${room.code}`);
    assert.deepEqual(update.data.clientData.hidden, [bensId]);
    assert.equal(update.data.stage, 2);

    voteFor(room, 'p1', ['p2', 'p3']);
    voteFor(room, 'p3', ['p2']);
    voteFor(room, 'p4', ['p1']);
    voteFor(room, 'p2', ['p1']);
    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('p2').raw, '0 votes', 'votes for a pulled entry are voided');
    assert.equal(row('p3').raw, '1 vote', 'the rest of those ballots still count');
    assert.equal(row('p1').raw, '2 votes');
    assert.equal(room.round.extras.caption.board.find((r) => r.name === 'Ben').hidden, true);
  } finally {
    room.destroy();
  }
});

test('the host can force a two-stage game forward from either stage', async () => {
  const { room } = await captionRoom(['Anna', 'Ben', 'Cat']);
  try {
    room.handleSubmit('p1', { text: 'anna answer' });
    room.handleSubmit('p2', { text: 'ben answer' });
    room.hostNext();                       // cut stage one short
    await waitFor(() => stageOf(room).stage === 2, 3000, 'stage two');
    room.hostNext();                       // cut the vote short, with no ballots
    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    for (const id of ['p1', 'p2']) {
      assert.equal(room.lastScores.find((r) => r.id === id).raw, '0 votes');
    }
  } finally {
    room.destroy();
  }
});

test('a solo test run of a two-stage game reaches a result with one player', async () => {
  const room = new Room(recordingIo(), 'SOLO', FAST);
  try {
    addPlayer(room, 'p1', 'Anna');
    assert.equal(room.startTest('caption').ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'stage one');
    room.handleSubmit('p1', { text: 'a lone practice answer' });
    await waitFor(() => room.phase === 'test_done', 4000, 'test done');
  } finally {
    room.destroy();
  }
});

// ---- Icebreaker: a game as long as the room, with a reveal between facts ----

// Boot an icebreaker-only room parked on stage one, everyone's fact already
// written, so the tests start where the guessing does.
async function icebreakerRoom(names, config = {}) {
  const io = recordingIo();
  const room = new Room(io, 'ICEB', { ...FAST, ...config, enabled: onlyGames('icebreaker') });
  names.forEach((name, i) => addPlayer(room, `p${i + 1}`, name));
  assert.equal(room.start().ok, true);
  await waitFor(() => room.phase === 'minigame', 3000, 'stage one');
  return { room, io };
}

async function writeFacts(room, ids) {
  // Named after the player, never their id — the tests assert that no
  // playerId is on the wire during a reveal, and a fact reading "p1 …" would
  // make that assertion pass or fail for the wrong reason.
  for (const id of ids) {
    room.handleSubmit(id, { text: `${room.players.get(id).name} once did something remarkable` });
  }
  await waitFor(() => stageOf(room).stage === 2, 3000, 'the first fun fact');
}

// Everyone locks a guess on the fact currently on screen. `picks` maps a
// guesser to the author they blame, or 'right' to hand them the answer.
function guessAll(room, picks) {
  const g = stageOf(room);
  for (const [id, pick] of Object.entries(picks)) {
    room.handleSubmit(id, { factId: g.clientData.factId, pick: pick === 'right' ? g.secret.answer : pick });
  }
  return g;
}

// The host's Next through a reveal: once to put the answer up, once to start
// the next fact.
async function throughReveal(room, expect) {
  await waitFor(() => room.phase === 'reveal', 3000, 'reveal');
  assert.equal(room.reveal.answered, false, 'the reveal opens on the discussion, not the answer');
  room.hostNext();
  assert.equal(room.reveal.answered, true, 'the first Next reveals the answer');
  room.hostNext();
  await waitFor(() => room.phase === expect, 3000, expect);
}

test('one fun fact at a time: the next never arrives before the last one closes', async () => {
  const { room, io } = await icebreakerRoom(['Anna', 'Ben', 'Cat']);
  try {
    const one = stageOf(room);
    assert.equal(one.stage, 1);
    assert.ok(one.clientData.prompt, 'stage one carries a seeded prompt');

    await writeFacts(room, ['p1', 'p2', 'p3']);
    assert.equal(room.round.games.length, 4, 'three facts became three guessing stages');
    assert.equal(stageOf(room).totalStages, 4);
    assert.equal(stageOf(room).stageName, 'Fun fact 1 of 3');

    // Two of three guess. The fact does not advance on its own, and it does
    // not advance to the NEXT fact when it closes — it stops for the reveal.
    guessAll(room, { p1: 'right', p2: 'p1' });
    assert.equal(room.phase, 'minigame', 'still on this fact — p3 has not answered');
    guessAll(room, { p3: 'right' });
    await waitFor(() => room.phase === 'reveal', 3000, 'reveal after the first fact');
    assert.equal(stageOf(room).clientData.round, 1, 'nobody has been served fact two yet');

    // The room discusses; the host reveals; only then does fact two start.
    room.hostNext();
    await sleep(120);
    assert.equal(room.phase, 'reveal', 'one press reveals the answer and nothing else');
    assert.equal(room.reveal.answered, true);
    room.hostNext();
    await waitFor(() => room.phase === 'minigame', 3000, 'fact two');
    assert.equal(stageOf(room).clientData.round, 2);

    guessAll(room, { p1: 'right', p2: 'right', p3: 'right' });
    await throughReveal(room, 'minigame');
    assert.equal(stageOf(room).clientData.round, 3, 'and on to the last one');
    guessAll(room, { p1: 'right', p2: 'right', p3: 'right' });
    await throughReveal(room, 'scores');

    // Exactly one scores phase for the whole game, and the facts went out in
    // one order, one at a time, to everybody.
    const games = phasePayloads(io).filter((p) => p.name === 'minigame');
    assert.deepEqual(games.map((p) => p.stage), [1, 2, 3, 4]);
    assert.deepEqual(games.slice(1).map((p) => p.clientData.round), [1, 2, 3]);
    assert.ok(games.slice(1).every((p) => p.room !== undefined || true));
    assert.equal(phasePayloads(io).filter((p) => p.name === 'scores').length, 1);
    // Every fact went to the whole room, never to one player.
    for (const e of io.events.filter((e) => e.event === 'phase')) {
      assert.equal(e.room, `room:${room.code}`);
    }
  } finally {
    room.destroy();
  }
});

test('scores: a point per fact matched to the right person, normalized like any game', async () => {
  const { room } = await icebreakerRoom(['Anna', 'Ben', 'Cat']);
  try {
    await writeFacts(room, ['p1', 'p2', 'p3']);
    for (let i = 0; i < 3; i++) {
      // Anna gets all three; Ben blames Anna every time (right once — her own
      // fact); Cat never guesses at all.
      guessAll(room, { p1: 'right', p2: 'p1' });
      await throughReveal(room, i === 2 ? 'scores' : 'minigame');
    }
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('p1').raw, '3 right');
    assert.equal(row('p2').raw, '1 right');
    assert.equal(row('p3').raw, '0 right', 'wrote a fact but never guessed — scored, at zero');
    assert.equal(row('p1').points, 1000, 'most right takes the game');
    assert.equal(row('p3').points, 0);
    const rounds = room.round.extras.icebreaker.rounds;
    assert.equal(rounds.length, 3);
    assert.ok(rounds.every((r) => r.name), 'the reveal table names every author');
    assert.equal(rounds.reduce((n, r) => n + r.rightCount, 0), 4);
  } finally {
    room.destroy();
  }
});

test('the answer is not broadcast until the host presses Next', async () => {
  const { room, io } = await icebreakerRoom(['Anna', 'Ben', 'Cat']);
  try {
    await writeFacts(room, ['p1', 'p2', 'p3']);
    const g = stageOf(room);
    // Two right, one deliberately wrong — whoever the seeded order put first.
    const wrong = ['p1', 'p2', 'p3'].find((id) => id !== g.secret.answer);
    guessAll(room, { p1: 'right', p2: 'right', p3: wrong });
    await waitFor(() => room.phase === 'reveal', 3000, 'reveal');

    const teaser = phasePayloads(io).filter((p) => p.name === 'reveal').pop();
    assert.equal(teaser.answered, false);
    assert.equal(teaser.guessed, 3, 'the room is told how many locked in, and no more');
    // The teaser goes to every device. Whatever else it carries, it carries
    // nothing that answers the question the room is about to argue about.
    assert.deepEqual(Object.keys(teaser).sort(), [
      'answered', 'gameName', 'guessed', 'hidden', 'key', 'name',
      'progress', 'round', 'stage', 'text', 'totalRounds', 'totalStages',
    ]);
    assert.ok(!JSON.stringify(teaser).includes(g.secret.answer),
      'the author is not on the wire — a player watching their own socket cannot cheat');

    room.hostNext();
    const answer = phasePayloads(io).filter((p) => p.name === 'reveal').pop();
    assert.equal(answer.answered, true);
    assert.equal(answer.name, 'reveal', 'the phase name is never shadowed by the payload');
    assert.equal(answer.playerId, g.secret.answer);
    assert.ok(answer.authorName, 'and now it has a name on it');
    assert.equal(answer.tally.reduce((n, t) => n + t.count, 0), 3);
    assert.equal(answer.guesses.filter((x) => x.correct).length, 2);
  } finally {
    room.destroy();
  }
});

test('reconnect mid-game lands on the fact the room is actually on', async () => {
  const { room } = await icebreakerRoom(['Anna', 'Ben', 'Cat']);
  try {
    await writeFacts(room, ['p1', 'p2', 'p3']);
    guessAll(room, { p1: 'right', p2: 'right', p3: 'right' });
    await throughReveal(room, 'minigame');

    const socket = { id: 'sock-new', join() {}, data: {} };
    const res = room.join(socket, { name: 'ignored', playerId: 'p3' });
    assert.equal(res.ok, true);
    assert.equal(res.snapshot.game.key, 'icebreaker');
    assert.equal(res.snapshot.game.stage, 3);
    assert.equal(res.snapshot.game.clientData.round, 2, 'the same fact everyone else is on');
    assert.equal(res.snapshot.game.clientData.options.length, 3);
    assert.equal(res.snapshot.game.stageName, 'Fun fact 2 of 3');
    assert.ok(!JSON.stringify(res.snapshot.game).includes('answer'));

    // And a reconnect during the reveal gets the reveal, in whichever half
    // the host has it.
    guessAll(room, { p1: 'right', p2: 'right', p3: 'right' });
    await waitFor(() => room.phase === 'reveal', 3000, 'reveal');
    assert.equal(room.join(socket, { playerId: 'p3' }).snapshot.reveal.answered, false);
    room.hostNext();
    const back = room.join(socket, { playerId: 'p3' }).snapshot.reveal;
    assert.equal(back.answered, true);
    assert.ok(back.authorName);
  } finally {
    room.destroy();
  }
});

test('the host can pull a fun fact off every screen; it scores nobody', async () => {
  const { room, io } = await icebreakerRoom(['Anna', 'Ben', 'Cat']);
  try {
    await writeFacts(room, ['p1', 'p2', 'p3']);
    const g = stageOf(room);
    assert.equal(room.hideEntry('nope').error, 'Unknown entry.');
    assert.equal(room.hideEntry(g.clientData.factId).hidden, true);

    const update = io.events.filter((e) => e.event === 'game:data').pop();
    assert.equal(update.room, `room:${room.code}`);
    assert.equal(update.data.clientData.hidden, true);
    assert.equal(update.data.clientData.text, '', 'the text is gone from the payload entirely');

    // Guesses already locked in on it are voided rather than counted wrong.
    guessAll(room, { p1: 'right', p2: 'right', p3: 'right' });
    await waitFor(() => room.phase === 'reveal', 3000, 'reveal');
    room.hostNext();
    const answer = phasePayloads(io).filter((p) => p.name === 'reveal').pop();
    assert.equal(answer.hidden, true);
    assert.equal(answer.playerId, null, 'a pulled fact does not out its author on the way past');
    assert.equal(answer.authorName, null);
    room.hostNext();

    for (let i = 0; i < 2; i++) {
      guessAll(room, { p1: 'right', p2: 'right', p3: 'right' });
      await throughReveal(room, i === 1 ? 'scores' : 'minigame');
    }
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('p1').raw, '2 right', 'the pulled fact scored nobody');
    const pulled = room.round.extras.icebreaker.rounds.find((r) => r.hidden);
    assert.equal(pulled.text, '');
    assert.equal(pulled.name, null);
    assert.equal(pulled.rightCount, 0);
  } finally {
    room.destroy();
  }
});

test('fewer than two fun facts: the guessing never runs and the room still scores', async () => {
  const { room, io } = await icebreakerRoom(['Anna', 'Ben', 'Cat']);
  try {
    room.handleSubmit('p2', { text: 'the only fact in the room' });
    await waitFor(() => room.phase === 'scores', 4000, 'scores');
    assert.equal(phasePayloads(io).filter((p) => p.name === 'minigame').length, 1,
      'nothing to guess between — no guessing stage is run');
    assert.equal(phasePayloads(io).filter((p) => p.name === 'reveal').length, 0);
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('p2').points, 1000, 'the only player who played it takes the game');
    assert.equal(row('p1').points, 0);
    assert.equal(row('p1').raw, 'no submission');
    assert.equal(room.round.extras.icebreaker.skipped, true);
  } finally {
    room.destroy();
  }
});

test('the host can force an icebreaker forward from any fact', async () => {
  const { room } = await icebreakerRoom(['Anna', 'Ben', 'Cat']);
  try {
    room.handleSubmit('p1', { text: 'anna fact' });
    room.handleSubmit('p2', { text: 'ben fact' });
    room.hostNext();                              // cut stage one short
    await waitFor(() => stageOf(room).stage === 2, 3000, 'fact one');
    room.hostNext();                              // cut the guessing short
    await throughReveal(room, 'minigame');
    room.hostNext();                              // and the last fact too
    await throughReveal(room, 'scores');
    for (const id of ['p1', 'p2']) {
      assert.equal(room.lastScores.find((r) => r.id === id).raw, '0 right');
    }
  } finally {
    room.destroy();
  }
});

test('solo practice drives its own reveals — no host screen to press Next', async () => {
  const room = new Room(recordingIo(), 'SOLO', FAST);
  try {
    room.solo = true;
    addPlayer(room, 'p1', 'Anna');
    addPlayer(room, 'p2', 'Ben');
    assert.equal(room.startTest('icebreaker').ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'stage one');
    room.handleSubmit('p1', { text: 'anna fact' });
    room.handleSubmit('p2', { text: 'ben fact' });
    await waitFor(() => stageOf(room).stage === 2, 3000, 'fact one');
    guessAll(room, { p1: 'right', p2: 'right' });
    await waitFor(() => room.phase === 'reveal', 3000, 'reveal');
    assert.equal(room.soloAdvance().ok, true);
    assert.equal(room.reveal.answered, true);
    assert.equal(room.soloAdvance().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'fact two');
    guessAll(room, { p1: 'right', p2: 'right' });
    await waitFor(() => room.phase === 'reveal', 3000, 'reveal');
    room.soloAdvance();
    room.soloAdvance();
    await waitFor(() => room.phase === 'test_done', 4000, 'test done');
    assert.equal(room.soloAdvance().error, 'Nothing to advance.');
  } finally {
    room.destroy();
  }
});

test('a guessing stage gets its own short window, not a whole minigame slot', async () => {
  const { room } = await icebreakerRoom(['Anna', 'Ben'], { gameDuration: 600 });
  try {
    const one = stageOf(room);
    assert.ok(one.deadline - Date.now() > 400, 'the writing stage gets the full duration');
    await writeFacts(room, ['p1', 'p2']);
    const g = stageOf(room);
    const window = g.deadline - Date.now();
    assert.ok(window > 100 && window < 400, `a guess is one tap, not a minigame (${window}ms)`);
    // Nobody guesses: the stage still closes on its own deadline and the room
    // moves on to the reveal rather than hanging.
    await waitFor(() => room.phase === 'reveal', 3000, 'reveal with no guesses at all');
    assert.equal(room.reveal.teaser.guessed, 0);
  } finally {
    room.destroy();
  }
});
