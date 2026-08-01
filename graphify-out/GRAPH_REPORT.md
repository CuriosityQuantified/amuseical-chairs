# Graph Report - amuseical-chairs  (2026-08-01)

## Corpus Check
- 41 files · ~66,952 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 398 nodes · 881 edges · 24 communities (19 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7c790788`
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
- redemption.test.js
- ciede2000.js
- normalize.js

## God Nodes (most connected - your core abstractions)
1. `Room` - 59 edges
2. `attachSockets()` - 21 edges
3. `el()` - 19 edges
4. `seededRng()` - 19 edges
5. `buildGameData()` - 15 edges
6. `clearAll()` - 14 edges
7. `el()` - 13 edges
8. `computeMetric()` - 13 edges
9. `cupsLevel()` - 13 edges
10. `content()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `README` --conceptually_related_to--> `Railway Deployment`  [INFERRED]
  README.md → .claude-progress.md
- `attachSockets()` --references--> `qrcode`  [EXTRACTED]
  server/sockets.js → package.json
- `withServer()` --calls--> `createServer()`  [EXTRACTED]
  test/smoke.test.js → server/app.js
- `onlyCups()` --references--> `ROSTER_BY_KEY`  [EXTRACTED]
  test/cups.test.js → server/games.js
- `onlyMetronome()` --references--> `ROSTER_BY_KEY`  [EXTRACTED]
  test/metronome.test.js → server/games.js

## Import Cycles
- None detected.

## Communities (24 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.11
Nodes (3): Room, sanitizeConfig(), attachSockets()

### Community 1 - "server/games.js"
Cohesion: 0.06
Nodes (64): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildGameData(), buildReveal(), buildStages(), CAPTION_PROMPTS, clamp() (+56 more)

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

### Community 21 - "redemption.test.js"
Cohesion: 0.48
Nodes (4): createRedemptionRun(), scoreRedemptionReport(), fakeClock(), run()

### Community 22 - "ciede2000.js"
Cohesion: 0.50
Nodes (5): ciede2000(), ciede2000Rgb(), deg(), rad(), rgbToLab()

### Community 23 - "normalize.js"
Cohesion: 0.90
Nodes (3): normalizeError(), normalizeScore(), percentile()

## Knowledge Gaps
- **75 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+70 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `server/games.js`, `Server Bootstrap & Test Harness`, `multistage.test.js`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `server/games.js`, `Project Dependencies`, `Server Bootstrap & Test Harness`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `qrcode` connect `Project Dependencies` to `Room`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _75 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.11298701298701298 - nodes in this community are weakly interconnected._
- **Should `server/games.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05966724039013196 - nodes in this community are weakly interconnected._
- **Should `check.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._