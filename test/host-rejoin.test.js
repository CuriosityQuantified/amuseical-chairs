import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/room.js';

const io = { to: () => ({ emit: () => {} }) };

function addPlayer(room, id, name) {
  room.players.set(id, {
    id, name, socketId: `socket-${id}`, connected: true,
    reconnectToken: `token-${id}`, disconnectedAt: null,
    sync: null, joinedAt: Date.now(),
  });
}

test('host snapshot contains the current phase payload and complete roster', () => {
  const room = new Room(io, 'JOIN', { tutorialMs: 1000 });
  try {
    addPlayer(room, 'p1', 'Alpha');
    addPlayer(room, 'p2', 'Bravo');
    room.setPhase('tutorial', { key: 'stopclock', gameName: 'Stopclock' });

    const snapshot = room.snapshot(null);

    assert.equal(snapshot.phase, 'tutorial');
    assert.deepEqual(snapshot.phasePayload, {
      name: 'tutorial',
      key: 'stopclock',
      gameName: 'Stopclock',
      progress: { players: 2, game: 1, totalGames: 1 },
    });
    assert.deepEqual(snapshot.players.map(({ id, name }) => ({ id, name })), [
      { id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Bravo' },
    ]);
  } finally {
    room.destroy();
  }
});

test('host minigame snapshot includes game data even when no player is selected', () => {
  const room = new Room(io, 'GAME', { gameDuration: 1000 });
  try {
    addPlayer(room, 'p1', 'Alpha');
    room.queue = ['stopclock'];
    room.queueIndex = 0;
    room.round = {
      test: false,
      games: [{
        key: 'stopclock', name: 'Stopclock', type: 'timing', category: 'timing',
        clientData: { target: 100 }, secret: { target: 100 },
        submissions: new Map(), metrics: new Map(), stage: 1, totalStages: 1,
        token: 'stage-token', deadline: Date.now() + 1000, duration: 1000,
      }],
      gameIndex: 0,
    };
    room.setPhase('minigame', room.gamePayload(room.round.games[0], 1000));

    const snapshot = room.snapshot(null);

    assert.equal(snapshot.phasePayload.name, 'minigame');
    assert.equal(snapshot.game.key, 'stopclock');
    assert.deepEqual(snapshot.game.clientData, { target: 100 });
    assert.equal(snapshot.players.length, 1);
  } finally {
    room.destroy();
  }
});
