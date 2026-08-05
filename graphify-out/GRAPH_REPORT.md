# Graph Report - amuseical-chairs  (2026-08-05)

## Corpus Check
- 52 files · ~80,512 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 455 nodes · 1047 edges · 23 communities (18 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `74820057`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- seededRng
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
- server/games.js
- graphify runbook

## God Nodes (most connected - your core abstractions)
1. `Room` - 60 edges
2. `seededRng()` - 39 edges
3. `buildGameData()` - 29 edges
4. `computeMetric()` - 22 edges
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

## Communities (23 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.11
Nodes (4): makeRoomCode(), Room, sanitizeConfig(), attachSockets()

### Community 1 - "seededRng"
Cohesion: 0.06
Nodes (61): buildGameData(), computeMetric(), formatRaw(), MULTI_STAGE, ROSTER_BY_KEY, anagramRounds(), isTrivialRotation(), scrambleWord() (+53 more)

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
Cohesion: 0.15
Nodes (11): createServer(), __dirname, { httpServer }, letters(), solveScramble(), Bot, botPayload(), sleep() (+3 more)

### Community 7 - "multistage.test.js"
Cohesion: 0.22
Nodes (14): NEEDS_AGGREGATION, addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo() (+6 more)

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
Cohesion: 0.09
Nodes (31): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), CAPTION_PROMPTS, clamp(), ICEBREAKER_PROMPTS (+23 more)

### Community 22 - "graphify runbook"
Cohesion: 0.12
Nodes (15): 0. Quickstart, 1. Install, 2. Write `.graphifyignore` before you extract, 3. Build the graph, 4. Decide what to commit, 5. Make it get used: MCP, not bash, 6. Keep it current, 7. The freshness gate (+7 more)

## Knowledge Gaps
- **95 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `seededRng`, `room.js`, `multistage.test.js`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `Project Dependencies`, `harness.test.js`, `multistage.test.js`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `qrcode` connect `Project Dependencies` to `Room`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.10839598997493734 - nodes in this community are weakly interconnected._
- **Should `seededRng` be split into smaller, more focused modules?**
  _Cohesion score 0.06317954745812518 - nodes in this community are weakly interconnected._
- **Should `room.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06533776301218161 - nodes in this community are weakly interconnected._