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
- Host config lives in the lobby screen and is deliberately one knob —
  **minigame duration** — plus the per-game toggles and the solo-test
  buttons. See *Host config* below before adding a second one.

```bash
npm test           # unit tests + 20-bot end-to-end harness
npm run check      # static checks the test suite can't do (see CI below)
```

## How a game works

Score attack — no elimination:

1. Games are drawn from a 14-game roster across 6 categories and played by
   **all players simultaneously**, in a seeded-shuffled order. Every enabled
   game is played exactly once — to shorten a session, turn games off. Music +
   circling avatars play between games.
2. Before each game (and the finale), everyone sees an **animated how-to
   tutorial**: looping ✓ DO / ✗ AVOID demos of the game. It loops until the
   host's Next — or the solo player's Skip — jumps straight in.
3. Most games are one payload with one deadline. **Caption Battle** and
   **Icebreaker** are multi-stage: the room submits, and what it submitted
   becomes the stages that follow. Every stage is still played by all players
   at once — see *Multi-stage games* below.
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
Stop the Clock draws a random 6–10s target, Metronome Blackout draws a
400–900ms beat that is never a whole number of BPM, Grid Flash varies pattern
sizes (6–9 cells), Slingshot jitters the distance ±25%, Trace picks from 15
shapes, and Read the Room draws from an **80-question humorous bank**
(Typing Sprint from 30 sentences, Caption Battle from 30 prompts, Icebreaker
from 16) with no repeats within a session. Icebreaker's fact order and its
candidate list are drawn the same way, so the room walks the same list in the
same order on every screen.

## Multi-stage games

A minigame is normally one payload with one deadline. A **multi-stage** game
collects from everyone, builds the stages that follow out of what the room
submitted, then collects from everyone again and scores at the end. Every
stage is played by every player at once — nothing here is turn-based.

Two rules hold for every one of them. **Degenerate pools are defined, not
accidental**: fewer than two usable submissions means there is nothing to
choose or guess between, so the later stages are skipped and stage 1 is
scored — the room always reaches a scores screen. And **reconnects between
stages** land on whatever stage the room is actually on, keep their identity
and running total, and score 0 for the stage they missed, the same as any
other missed submission.

### Caption Battle

Stage 1: everyone answers the same seeded prompt. Stage 2: everyone reads the
**anonymized** pool and spends 3 votes. Score = votes received; authorship is
revealed only at the score reveal.

- **Why 3 votes and not 1.** Vote-based scoring concentrates: a room of 20
  puts its votes on 3–4 answers, and everyone else ties at the floor for a
  whole game. Multiple votes per player flattens the distribution so mid-tier
  answers separate from zero. The budget clamps to *pool size − 1*, so it can
  never be spent on yourself.
- **Self-votes** are rejected server-side by `playerId`. The client greys out
  your own entry as a courtesy; it is not the enforcement.
- **2 players works** — each can vote only for the other.
- **Pacing.** Two deadlines plus time for the room to *read* costs roughly
  double a normal slot. The lobby marks it `⏱⏱`.

### Icebreaker

As long as the room. Stage 1: everyone writes one true fun fact about
themselves. Then the room is served those facts **one at a time** — same
fact, same order, same candidate list on every screen — and everyone picks
who they think wrote it. Nobody sees the next fact until the current one
closes for everybody. Between facts the room stops: the host screen invites
the discussion (*"who wrote it?"*, everyone says their pick out loud), the
host's **Next** puts the answer on the projector, and **Next** again starts
the next fact. Score = facts matched to the right person.

- **Every player is an option on every fact**, including yourself and
  including anyone who never wrote one, in one order that never moves. The
  same name can be picked as often as you like; only the correct picks score.
- **Your own fact is a free point**, by design. Everyone in the room has
  exactly one, so it cancels out — and it beats greying out your own name
  mid-game, which would tell the room something. Your screen quietly notes
  *"this one's yours"* so you aren't left wondering.
- **The answer is never broadcast early.** Until the host presses Next the
  server has not sent authorship to any device — the discussion half of the
  reveal carries the fact and a count of locked-in guesses, nothing more.
- **Pacing.** One guessing stage per fun fact, each on half a normal slot, so
  the game costs roughly *players ÷ 2* slots on top of the writing stage. The
  lobby marks it `⏱×players`, the way Caption Battle is marked `⏱⏱` — a big
  room should know what it is enabling before it plans a meeting around it.

### Moderation

Player-authored text reaches a projector in a work meeting, and there is no
undo on a room full of people reading something. Every string is normalized
once, server-side, on the way into the pool (`shared/textclean.js`): length
capped by code point, control and format characters stripped (including the
bidi overrides that render text in an order it wasn't typed in), newlines and
tabs collapsed, Zalgo mark stacks capped. The host screen has a **hide this
entry** control that removes an entry from every screen immediately and voids
every vote or guess cast for it — for Caption Battle one entry out of the
pool, for Icebreaker the single fun fact currently on the projector, which
then scores nobody and is not attributed to anyone at the reveal.

The host screen shows what the room has to read — Caption Battle's pool
during the vote, Icebreaker's one fact during the guess — plus a count of how
many players have answered. Per-entry tallies and running scores stay off the
projector until the moment they are the point: **live scores never appear on
the host screen**, for these games or any other. Icebreaker's between-facts
reveal shows who wrote the fact and how the room voted on *that fact*; it
never shows anyone's running total.

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
- **Metronome Blackout:** taps are consumed *in order* against the beat grid,
  never matched to whichever beat they landed nearest — so filling the window
  with taps buys a worse average, never a better one, and a missed beat costs
  exactly what the most wrong possible tap costs. The beat is a whole number of
  milliseconds that is never a whole number of BPM (`60000 % intervalMs !== 0`),
  which makes a metronome app impractical — you would still have to match phase
  inside one round — rather than impossible. That trade is accepted knowingly;
  the airtight version is a mid-round tempo change, at the cost of a harder
  game. Unlike the finale, none of this needs clock sync: the grid is scheduled
  and the taps are timed on the same device, so network latency never enters
  the metric.

## Host config

The lobby's config panel is **minigame duration**, the per-game toggles, and
the solo-test buttons. That is the whole host-facing surface, and it is
enforced rather than remembered:

- `HOST_EDITABLE_CONFIG` in `server/room.js` is the only set of config keys
  `updateConfig` accepts from the lobby; anything else in a `host:config`
  patch is dropped.
- `publicConfig()` publishes no value the host is not allowed to change, so a
  control has nothing to render from either.
- `npm run check` fails on any `cfg-*` control in `public/host.html` or
  `public/js/host.js` that is not on its allowlist, and on the two ends of
  that allowlist disagreeing.
- `test/room.test.js` asserts the published keys and that a patch carrying
  `gamesPerSession` changes nothing.

Everything else — `gamesPerSession`, the tutorial and pacing knobs, the
early-press penalty, the slingshot distance — is an internal default. A room
can be constructed with them (the bot harness runs a full session in seconds
that way), but no host screen shows them. `Games this session` and `Practice
round first` were both host controls once and both grew back with a later
feature; the checks above exist because nothing failed when they did. Adding a
host option on purpose means changing the control, the allowlist in
`scripts/check.mjs`, and `HOST_EDITABLE_CONFIG` together.

**There is no practice round.** A session opens on game one, for points —
`practice` is not a config key, `startPractice()` and the `practice_done`
phase are gone, and `test/room.test.js` fails if a room ever enters one.
Anyone who wants to shake a game out beforehand runs it from the lobby's
**Solo test** buttons, which is what they are for. Every enabled game is
played; to shorten a session, turn games off.

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
public/   host screen, player screen, 14 minigame clients
test/     unit tests + room integration + 20-headless-bot harness
scripts/  static checks run in CI
graphify-out/  knowledge graph of this repo (see below)
```

## Knowledge graph

This repo carries a [graphify](https://github.com/Graphify-Labs/graphify) map of
itself in `graphify-out/`, so a question about the codebase can be *asked*
rather than grepped:

```bash
graphify query "how does clock sync and redemption scoring work?"
graphify path "Room" "seededRng()"     # how two things connect
graphify explain "Room"                # one concept and its 57 neighbours
graphify affected "seededRng()"        # what breaks if this changes
npm run graph:report                   # the god nodes, quickest look
```

`graphify-out/graph.html` is the same graph as a clickable force-directed map.
`GRAPH_REPORT.md` is the prose version: god nodes, communities, the connections
worth knowing, and the questions the graph is best placed to answer.

One caveat on `graph.html`: it loads `vis-network` from unpkg, so unlike the
rest of this repo it wants a network to render. That is graphify's output, not
ours — `graph.json` and `GRAPH_REPORT.md` are entirely self-contained, and every
`graphify` command works offline.

`affected` earns its place here. This codebase has a standing rule that round
content comes from the seeded RNG and never from `Math.random()`, enforced by
`npm run check` — and `graphify affected "seededRng()"` lists the eight call
sites in `server/room.js` plus the tests and `scripts/check.mjs` that depend on
it, 20 nodes in all: the blast radius that rule exists to protect.

### Setup

```bash
uv tool install "graphifyy[mcp]"   # or: pipx install "graphifyy[mcp]"
npm run graph:setup                # skill, hooks, post-commit rebuild, merge driver
```

`graph:setup` is `graphify install --project && graphify hook install`, and it is
the whole per-machine story. Take the `[mcp]` extra: without it the MCP server
below cannot start.

Committed, so it is there on clone: `.claude/skills/graphify/` (the `/graphify`
skill), `.mcp.json`, and `.gitattributes`. Deliberately **not** committed: the
`PreToolUse` hooks and the post-commit rebuild, because `graphify install` and
`graphify hook install` both embed the absolute path of the interpreter that ran
them — correct on one machine, a broken hook on every other. Those land in the
gitignored `.claude/settings.local.json` and in `.git/hooks/`, which is why you
run the setup yourself rather than inheriting someone else's paths.

### The graph as tools, not commands

`.mcp.json` registers graphify as a project MCP server, so an assistant working
in this repo gets the graph as **native tools** — `query_graph`, `shortest_path`,
`get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats` — rather
than a bash incantation it has to remember. That is the difference between a
graph that gets used and a graph that gets documented.

The soft `PreToolUse` nudge stays advisory on top of it: it reminds, it never
blocks. Nothing in this repo denies you a plain `grep`.

### Why merges don't rot it

`.gitattributes` assigns `graphify-out/graph.json` a union merge driver, because
that file is ~13k lines of JSON that two branches will both touch. Without the
driver every branch merge is a conflict in a generated file, and the realistic
outcome of that is not careful conflict resolution — it is somebody deleting the
graph. `npm run graph:setup` registers the driver half in your git config; git
falls back to an ordinary text merge if you skipped it, so the committed
`.gitattributes` is safe either way.

### Keeping it current

```bash
npm run graph            # graphify update .  — AST only, no API key, no cost
npm run graph:rebuild    # graphify extract . — also re-reads docs, needs a backend
```

- **The code half is deterministic and free.** Every code node and edge comes
  from a local tree-sitter parse: no API calls, nothing leaves the machine, same
  input same output. That is the half `npm run graph` refreshes, and it is the
  half that matters after a normal change.
- **Two things here did use an LLM:** the semantic pass over the 5 non-code
  files (`README.md`, `.claude-progress.md`, both HTML screens, the CI
  workflow), and the community names. Neither is needed to query the graph.
- **Community names drift.** Leiden clustering is not perfectly stable, so a
  rebuild can shuffle communities and fall back to naming a few after their hub
  node. `graphify label .` renames them; nothing else is affected.
- **`npm run check` fails on a stale graph, and CI runs it.** Rule 7 compares
  every indexed file against the content hash the graph was built from, kept in
  `graphify-out/graph-lock.json`. Edit a module, delete one, or add one without
  refreshing, and the build tells you to run `npm run graph`. This is the same
  bet as the host-config allowlist: a stale graph looks right from every angle
  and answers wrong, so something has to say otherwise.
- **Freshness is checked by hash, not by commit.** Two tempting versions of that
  rule are both broken, and it is worth knowing why before rewriting it.
  `GRAPH_REPORT.md` records the commit the graph was built from and *cannot*
  record the commit that adds it, so comparing against `HEAD` always reads one
  behind. Requiring `graph.json` in the same diff as the code is worse: it is
  satisfied by whichever commit first added the graph and then passes forever —
  the rule was written that way first, and the mutation test caught it. And
  rebuilding inside CI to diff would be flaky, because clustering isn't stable.
- **The post-commit hook does the refresh for you.** `npm run graph:setup`
  installs it; after each commit the code half rebuilds and you commit the
  result. Rule 7 looks at the working tree, not a commit range, so it does not
  care whether the graph rides along in the same commit or the next one.

### What is deliberately not in the graph

`.graphifyignore` holds the exclusions, and one is worth explaining.
`public/vendor/` is 2MB of vendored three.js against roughly 300KB of this
project. Indexed, it wins outright: the god nodes come back `Vector3`,
`WebGLRenderer`, `Object3D`, `Matrix4`, and `Room` — the actual centre of this
system — places third. A graph of this codebase is a graph of the code this repo
is answerable for, so the vendored library, graphify's own 124KB of skill
documentation, and `package-lock.json` all stay out. What remains is a few
hundred nodes across a couple dozen communities, and `Room` sits at the top of it
where it belongs. `GRAPH_REPORT.md` carries the exact counts — quoting them in
prose is a losing game, since editing this paragraph changes the graph that
describes it.

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to
`main`; the same checks run locally with `npm run check` and `npm test`.
(The workflow spent two branches parked at `docs/ci-workflow.yml`, because
the token that wrote it could not push to `.github/workflows/`. It is
installed now — that file is gone, and there is one copy.)

The workflow runs:

- **Static checks** (`npm run check`) — the browser half of this app has no
  build step, so `node --test` never parses `public/js/*.js` at all. The
  checker parses every source file, verifies client modules only import
  absolute paths (there is no bundler, so a bare specifier is a 404 on a
  player's phone), verifies every roster game has both a client and a
  tutorial and that multi-stage games are wired end to end, rejects
  `Math.random()` in server or shared code — round content must come from the
  seeded RNG or the room silently desyncs — holds the host config panel to
  its one knob (see *Host config* above), and fails when the committed knowledge
  graph has gone stale against the code it describes (see *Knowledge graph*).
  That last rule compares file hashes rather than git history, so it needs no
  extra checkout depth and holds in a shallow clone.
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
