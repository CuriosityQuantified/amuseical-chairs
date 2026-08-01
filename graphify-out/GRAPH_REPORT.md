# Graph Report - amuseical-chairs  (2026-08-01)

## Corpus Check
- 39 files · ~60,126 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 377 nodes · 820 edges · 22 communities (17 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c0fe2f80`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- server/games.js
- check.mjs
- Host UI Lobby Setup
- Player Client Sync UI
- Project Dependencies
- Server Bootstrap & Test Harness
- multistage.test.js
- js/games.js
- Tutorial Drawing Animations
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
- redemption.test.js

## God Nodes (most connected - your core abstractions)
1. `Room` - 58 edges
2. `attachSockets()` - 21 edges
3. `el()` - 19 edges
4. `seededRng()` - 15 edges
5. `clearAll()` - 14 edges
6. `el()` - 13 edges
7. `buildGameData()` - 13 edges
8. `content()` - 12 edges
9. `content()` - 11 edges
10. `buildStages()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `README` --conceptually_related_to--> `Railway Deployment`  [INFERRED]
  README.md → .claude-progress.md
- `attachSockets()` --references--> `qrcode`  [EXTRACTED]
  server/sockets.js → package.json
- `withServer()` --calls--> `createServer()`  [EXTRACTED]
  test/smoke.test.js → server/app.js
- `onlyMetronome()` --references--> `ROSTER_BY_KEY`  [EXTRACTED]
  test/metronome.test.js → server/games.js
- `facts()` --calls--> `buildStages()`  [EXTRACTED]
  test/icebreaker.test.js → server/games.js

## Import Cycles
- None detected.

## Communities (22 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.11
Nodes (4): NEEDS_AGGREGATION, Room, sanitizeConfig(), attachSockets()

### Community 1 - "server/games.js"
Cohesion: 0.06
Nodes (56): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildGameData(), buildReveal(), buildStages(), CAPTION_PROMPTS, clamp() (+48 more)

### Community 2 - "check.mjs"
Cohesion: 0.11
Nodes (17): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+9 more)

### Community 3 - "Host UI Lobby Setup"
Cohesion: 0.14
Nodes (31): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+23 more)

### Community 4 - "Player Client Sync UI"
Cohesion: 0.18
Nodes (31): applySnapshot(), banner(), clearAll(), clearAllButBanner(), content(), doSync(), el(), enterRoom() (+23 more)

### Community 5 - "Project Dependencies"
Cohesion: 0.07
Nodes (27): express, dependencies, express, qrcode, socket.io, three, description, devDependencies (+19 more)

### Community 6 - "Server Bootstrap & Test Harness"
Cohesion: 0.10
Nodes (13): createServer(), __dirname, ROSTER, { httpServer }, Bot, botPayload(), sleep(), TEST_CONFIG (+5 more)

### Community 7 - "multistage.test.js"
Cohesion: 0.22
Nodes (13): addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo(), sleep() (+5 more)

### Community 8 - "js/games.js"
Cohesion: 0.25
Nodes (14): availHeight(), canvasPos(), clamp(), GameClients, h(), makeCanvas(), polygonPath(), SHAPE_CORNERS (+6 more)

### Community 9 - "Tutorial Drawing Animations"
Cohesion: 0.18
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

### Community 21 - "redemption.test.js"
Cohesion: 0.48
Nodes (4): createRedemptionRun(), scoreRedemptionReport(), fakeClock(), run()

## Knowledge Gaps
- **74 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+69 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `server/games.js`, `Server Bootstrap & Test Harness`, `multistage.test.js`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `server/games.js`, `Project Dependencies`, `Server Bootstrap & Test Harness`, `multistage.test.js`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `qrcode` connect `Project Dependencies` to `Room`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _74 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.11178451178451178 - nodes in this community are weakly interconnected._
- **Should `server/games.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06151742993848257 - nodes in this community are weakly interconnected._
- **Should `check.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._