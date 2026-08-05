# Graph Report - amuseical-chairs  (2026-08-05)

## Corpus Check
- 50 files · ~78,730 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 465 nodes · 1063 edges · 24 communities (19 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `80c9b77b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- server/games.js
- room.js
- Host UI Lobby Setup
- Player Client Sync UI
- Project Dependencies
- harness.test.js
- multistage.test.js
- js/games.js
- tutorials.js
- Musical Chairs Game
- Project Docs & Progress Log
- Answer Clustering Logic
- Graph Lock File
- CI Workflow Jobs
- Clock Sync Utility
- Press Counter Utility
- Graphify MCP Config
- Claude Skill Docs
- Host Screen UI
- Player Join/Play Screen
- caption.test.js
- graphify runbook
- balance.test.js

## God Nodes (most connected - your core abstractions)
1. `Room` - 59 edges
2. `seededRng()` - 35 edges
3. `buildGameData()` - 26 edges
4. `computeMetric()` - 21 edges
5. `attachSockets()` - 21 edges
6. `el()` - 19 edges
7. `clearAll()` - 14 edges
8. `ROSTER_BY_KEY` - 14 edges
9. `el()` - 13 edges
10. `formatRaw()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/icebreaker.test.js → shared/rng.js
- `README` --conceptually_related_to--> `Railway Deployment`  [INFERRED]
  README.md → .claude-progress.md
- `attachSockets()` --references--> `qrcode`  [EXTRACTED]
  server/sockets.js → package.json
- `withServer()` --calls--> `createServer()`  [EXTRACTED]
  test/smoke.test.js → server/app.js

## Import Cycles
- None detected.

## Communities (24 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.11
Nodes (4): makeRoomCode(), Room, sanitizeConfig(), attachSockets()

### Community 1 - "server/games.js"
Cohesion: 0.06
Nodes (68): buildGameData(), CAPTION_PROMPTS, clamp(), computeMetric(), formatRaw(), ICEBREAKER_PROMPTS, METRONOME_INTERVALS, MULTI_STAGE (+60 more)

### Community 2 - "room.js"
Cohesion: 0.07
Nodes (30): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+22 more)

### Community 3 - "Host UI Lobby Setup"
Cohesion: 0.14
Nodes (31): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+23 more)

### Community 4 - "Player Client Sync UI"
Cohesion: 0.18
Nodes (31): applySnapshot(), banner(), clearAll(), clearAllButBanner(), content(), doSync(), el(), enterRoom() (+23 more)

### Community 5 - "Project Dependencies"
Cohesion: 0.07
Nodes (27): express, dependencies, express, qrcode, socket.io, three, description, devDependencies (+19 more)

### Community 6 - "harness.test.js"
Cohesion: 0.16
Nodes (9): createServer(), __dirname, { httpServer }, Bot, botPayload(), sleep(), TEST_CONFIG, ROOT (+1 more)

### Community 7 - "multistage.test.js"
Cohesion: 0.24
Nodes (13): addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo(), sleep() (+5 more)

### Community 8 - "js/games.js"
Cohesion: 0.25
Nodes (14): availHeight(), canvasPos(), clamp(), GameClients, h(), makeCanvas(), polygonPath(), SHAPE_CORNERS (+6 more)

### Community 9 - "tutorials.js"
Cohesion: 0.16
Nodes (13): box(), C, clamp01(), cursor(), drawPolyline(), ease(), rr(), SCATTER (+5 more)

### Community 10 - "Musical Chairs Game"
Cohesion: 0.36
Nodes (8): chairLayout(), colorFor(), drawAvatar(), drawChairRing(), makeCanvas(), NEON, startChairs(), startChairsSeated()

### Community 11 - "Project Docs & Progress Log"
Cohesion: 0.39
Nodes (8): Progress Log, Caption Battle, Icebreaker, graphify (Knowledge Graph Tool), graphify MCP Tools, public/vendor/ (three.js), Railway Deployment, README

### Community 12 - "Answer Clustering Logic"
Cohesion: 0.62
Nodes (5): ARTICLES, clusterAnswers(), levenshtein(), mostCommon(), normalizeAnswer()

### Community 13 - "Graph Lock File"
Cohesion: 0.40
Nodes (4): files, LOCK, MANIFEST, ROOT

### Community 14 - "CI Workflow Jobs"
Cohesion: 0.50
Nodes (4): CI Workflow, CI: Dependency Audit Job, CI: Static Checks Job, CI: Tests Job

### Community 15 - "Clock Sync Utility"
Cohesion: 0.83
Nodes (3): pingOnce(), sleep(), syncClock()

### Community 21 - "caption.test.js"
Cohesion: 0.13
Nodes (20): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), icebreakerTally(), num(), votesForPool() (+12 more)

### Community 22 - "graphify runbook"
Cohesion: 0.12
Nodes (15): 0. Quickstart, 1. Install, 2. Write `.graphifyignore` before you extract, 3. Build the graph, 4. Decide what to commit, 5. Make it get used: MCP, not bash, 6. Keep it current, 7. The freshness gate (+7 more)

### Community 23 - "balance.test.js"
Cohesion: 0.15
Nodes (20): BALANCE_CTRL_D, BALANCE_CTRL_K, BALANCE_DAMPING, BALANCE_DT, BALANCE_FIRST_NUDGE_MS, BALANCE_GRAVITY, BALANCE_LENGTH, BALANCE_MAX_ANGLE (+12 more)

## Knowledge Gaps
- **96 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `server/games.js`, `room.js`, `multistage.test.js`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `Project Dependencies`, `harness.test.js`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `qrcode` connect `Project Dependencies` to `Room`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _96 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.10768300060496068 - nodes in this community are weakly interconnected._
- **Should `server/games.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06292749658002736 - nodes in this community are weakly interconnected._
- **Should `room.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06533776301218161 - nodes in this community are weakly interconnected._