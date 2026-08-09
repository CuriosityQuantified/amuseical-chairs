# Graph Report - amuseical-chairs  (2026-08-08)

## Corpus Check
- 52 files · ~81,848 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 456 nodes · 1053 edges · 25 communities (19 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8ad44b2a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- seededRng
- room.js
- Host UI Lobby Setup
- Player Client Sync UI
- Project Dependencies
- Bot
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
- server/games.js
- graphify runbook
- check.mjs
- balance.test.js

## God Nodes (most connected - your core abstractions)
1. `Room` - 60 edges
2. `seededRng()` - 39 edges
3. `buildGameData()` - 30 edges
4. `computeMetric()` - 21 edges
5. `attachSockets()` - 21 edges
6. `el()` - 19 edges
7. `ROSTER_BY_KEY` - 15 edges
8. `clearAll()` - 14 edges
9. `formatRaw()` - 14 edges
10. `el()` - 13 edges

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

## Communities (25 total, 6 thin omitted)

### Community 0 - "Room"
Cohesion: 0.09
Nodes (11): read(), createServer(), __dirname, { httpServer }, HOST_EDITABLE_CONFIG, makeRoomCode(), Room, sanitizeConfig() (+3 more)

### Community 1 - "seededRng"
Cohesion: 0.06
Nodes (61): buildGameData(), computeMetric(), MULTI_STAGE, NEEDS_AGGREGATION, pickContent(), ROSTER_BY_KEY, anagramRounds(), isTrivialRotation() (+53 more)

### Community 2 - "room.js"
Cohesion: 0.13
Nodes (13): formatRaw(), ROSTER, DEFAULTS, normalizeError(), normalizeScore(), percentile(), createRedemptionRun(), scoreRedemptionReport() (+5 more)

### Community 3 - "Host UI Lobby Setup"
Cohesion: 0.14
Nodes (31): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+23 more)

### Community 4 - "Player Client Sync UI"
Cohesion: 0.18
Nodes (31): applySnapshot(), banner(), clearAll(), clearAllButBanner(), content(), doSync(), el(), enterRoom() (+23 more)

### Community 5 - "Project Dependencies"
Cohesion: 0.07
Nodes (27): express, dependencies, express, qrcode, socket.io, three, description, devDependencies (+19 more)

### Community 7 - "multistage.test.js"
Cohesion: 0.22
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

### Community 21 - "server/games.js"
Cohesion: 0.10
Nodes (30): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), CAPTION_PROMPTS, clamp(), ICEBREAKER_PROMPTS (+22 more)

### Community 22 - "graphify runbook"
Cohesion: 0.12
Nodes (15): 0. Quickstart, 1. Install, 2. Write `.graphifyignore` before you extract, 3. Build the graph, 4. Decide what to commit, 5. Make it get used: MCP, not bash, 6. Keep it current, 7. The freshness gate (+7 more)

### Community 23 - "check.mjs"
Cohesion: 0.11
Nodes (16): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+8 more)

### Community 24 - "balance.test.js"
Cohesion: 0.47
Nodes (7): balanceControl(), balanceSchedule(), balanceState(), balanceStep(), CONFIG, play(), steerTowardFall()

## Knowledge Gaps
- **96 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `seededRng`, `room.js`, `multistage.test.js`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `Project Dependencies`, `multistage.test.js`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `qrcode` connect `Project Dependencies` to `Room`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _96 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.08779761904761904 - nodes in this community are weakly interconnected._
- **Should `seededRng` be split into smaller, more focused modules?**
  _Cohesion score 0.06323396567299007 - nodes in this community are weakly interconnected._
- **Should `room.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._