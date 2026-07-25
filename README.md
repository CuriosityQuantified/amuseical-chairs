# 🎵 Musical Chairs

A hybrid-meeting party game: classic musical chairs with the scramble for a
seat replaced by a **skill scramble**. One projected host screen, every player
on their own phone or laptop. 2–30 players, ~20 minutes including rules.

Every scoring round is played by **all surviving players simultaneously** —
nothing is turn-based.

## Quick start

```bash
npm install
npm start          # http://localhost:3000
```

- **Host:** open `/host.html`, create a room, project the screen.
- **Players:** scan the QR / open `/?code=XXXX`, enter a name.
- Host config (durations, per-game toggles, practice round) lives in the
  lobby screen.

```bash
npm test           # unit tests + 20-bot end-to-end harness
npm run check      # static checks the test suite can't do (see CI below)
```

## How a game works

Score attack — no elimination:

1. Games are drawn from a 12-game roster across 6 categories and played by
   **all players simultaneously**, in a seeded-shuffled order. By default
   every enabled game is played exactly once; the host can instead draw
   **K of N** (`Games this session`) to fit a shorter meeting slot. Music +
   circling avatars play between games.
2. Before each game (and the finale), everyone sees an **animated how-to
   tutorial**: looping ✓ DO / ✗ AVOID demos of the game. Duration is a host
   config knob (default 9s, 0 = off); the host's Next — or the solo
   player's Skip — jumps straight in.
3. Most games are one payload with one deadline. **Caption Battle** is
   two-stage: everyone answers the same prompt, then everyone reads the
   anonymized pool built from those answers and spends 3 votes on it. Both
   stages are played by all players at once — see *Two-stage games* below.
4. Raw metrics are normalized per game to 0–1000 **across only the players
   who played it** (P90/P10 outlier clamps; no rank-summing). Non-submitters
   score 0 for that game but stay in.
5. After every game, each player sees their raw result, points earned,
   running total, and rank; a **live leaderboard strip** stays pinned to the
   top of every player screen and the host screen for the whole session.
6. The finale is **musical chairs** — a bonus elimination tournament of
   clock-synced reaction rounds. With N players there are N−1 rounds; every
   round shows one chair fewer than the players still in (players − 1), the
   slowest reaction is eliminated, and everyone else's avatar visibly takes
   a chair. Play continues until one player holds the last chair. Final
   placement pays **3× bonus points** (1st = 3000 … last = 0, linear).
7. Highest cumulative total wins.

Round content is randomized **server-side** with a seeded RNG and broadcast
to every player, so everyone always plays the identical configuration:
Stop the Clock draws a random 6–10s target, Grid Flash varies pattern sizes
(6–9 cells), Slingshot jitters the distance ±25%, Trace picks from 15
shapes, and Read the Room draws from an **80-question humorous bank**
(Typing Sprint from 30 sentences, Caption Battle from 30 prompts) with no
repeats within a session.

## Two-stage games

A minigame is normally one payload with one deadline. A **two-stage** game
collects from everyone, builds the second stage's content out of what the
room submitted, then collects from everyone again and scores. Both stages are
played by every player at once — nothing here is turn-based.

**Caption Battle** is the one on the roster. Stage 1: everyone answers the
same seeded prompt. Stage 2: everyone reads the **anonymized** pool and
spends 3 votes. Score = votes received; authorship is revealed only at the
score reveal.

- **Why 3 votes and not 1.** Vote-based scoring concentrates: a room of 20
  puts its votes on 3–4 answers, and everyone else ties at the floor for a
  whole game. Multiple votes per player flattens the distribution so mid-tier
  answers separate from zero. The budget clamps to *pool size − 1*, so it can
  never be spent on yourself.
- **Self-votes** are rejected server-side by `playerId`. The client greys out
  your own entry as a courtesy; it is not the enforcement.
- **Degenerate pools are defined, not accidental.** 0 or 1 usable answers
  means there is nothing to choose between: stage 2 is skipped and stage 1 is
  scored, so the room always reaches a scores screen. 2 players works — each
  can vote only for the other.
- **Reconnects between stages** land on stage 2 with the pool, keep their
  identity and running total, and score 0 for the stage they missed — the
  same as any other missed submission.
- **Pacing.** A two-stage game costs roughly double a normal slot (two
  deadlines, plus time for the room to *read*). That is what the K-of-N
  `Games this session` draw is for.

### Moderation

Player-authored text reaches a projector in a work meeting, and there is no
undo on a room full of people reading something. Every string is normalized
once, server-side, on the way into the pool (`shared/textclean.js`): length
capped by code point, control and format characters stripped (including the
bidi overrides that render text in an order it wasn't typed in), newlines and
tabs collapsed, Zalgo mark stacks capped. The host screen has a **hide this
entry** control that removes an entry from every screen immediately and voids
every vote cast for it.

The host screen shows the pool during stage 2 so the room can read it, and a
count of how many players have voted. Per-entry tallies stay off the
projector until scoring — **live scores never appear on the host screen**,
for this game or any other.

## Anti-cheat details worth knowing

- **Redemption mashing:** any press before green silently redraws the delay
  and reschedules green from the moment of the press. A masher never sees
  green, hits the 25s hard timeout, and takes last place. A single
  anticipatory press costs a fair 10% penalty.
- **Clock sync:** NTP-style offset estimation on join and again before every
  redemption round; green is scheduled at absolute server time, timed on the
  client from the rendered frame to `keydown` — network latency never touches
  the measurement. The host screen shows a per-player sync-confidence dot.
- **Space Mash:** counting requires a `keyup` between `keydown`s (holding the
  spacebar scores 1, not 300), plus a rolling 20 presses/sec anti-macro cap.
- **Color match** is scored with CIEDE2000 (perceptual), not RGB distance.

## Architecture

- Node 20 + Express + **Socket.IO** (persistent websockets — the clock sync
  depends on them). Client is vanilla JS + Canvas, no build step.
- **All state in memory. No database.** Sessions are ephemeral by design.
- Reconnects: `playerId` persists in `localStorage`; a dropped player never
  loses their identity or score for a wifi hiccup — missed submissions
  simply score 0 for that game.
- `shared/` holds pure logic (normalization, redemption state machine,
  press counter, CIEDE2000) served unmodified to the
  browser and imported directly by server + tests.

```
server/   express + socket wiring, room state machine, game metrics
shared/   pure logic used by server, client, and tests
public/   host screen, player screen, 12 minigame clients
test/     unit tests + room integration + 20-headless-bot harness
scripts/  static checks run in CI
```

## CI

`.github/workflows/ci.yml` runs on every pull request:

- **Static checks** (`npm run check`) — the browser half of this app has no
  build step, so `node --test` never parses `public/js/*.js` at all. The
  checker parses every source file, verifies client modules only import
  absolute paths (there is no bundler, so a bare specifier is a 404 on a
  player's phone), verifies every roster game has both a client and a
  tutorial and that two-stage games are wired end to end, and rejects
  `Math.random()` in server or shared code — round content must come from the
  seeded RNG or the room silently desyncs.
- **Tests** on Node 20, 22 and 24. Every bug in this system is a 20-player
  concurrency bug, and those surface differently across Node's timer and
  socket behaviour.
- **Dependency audit** on the production tree.

`test/smoke.test.js` boots the real server and fetches every absolute import
found in the client modules — an unserved `/shared/*.js` is a 404 in the
browser and green in every other test.

## Deployment

Deploy anywhere that holds a long-lived websocket: **Railway, Render, or
Fly.io** (`npm start`, port from `$PORT`). Vercel serverless is a poor fit —
it won't hold websockets and the clock sync degrades; if you must, swap in a
dedicated realtime service. Simplest fallback: run on the host's laptop
behind a Cloudflare Tunnel.

## Out of scope (by design)

Accounts, persistence, cross-session leaderboards, native apps, spectators,
anything requiring pre-gathered player data, and
any turn-based mechanic whatsoever.
