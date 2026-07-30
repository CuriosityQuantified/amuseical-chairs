# Graph Report - .  (2026-07-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 361 nodes · 773 edges · 21 communities (16 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.57)
- Token cost: 37,753 input · 389 output

## Graph Freshness
- Built from commit: `d1527c3c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Game Room Lifecycle
- Game Data Aggregation
- Host Control Validation Script
- Host UI Lobby Setup
- Player Client Sync UI
- Project Dependencies
- Server Bootstrap & Test Harness
- Multi-Game Integration Tests
- Game Canvas Client Utils
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

## God Nodes (most connected - your core abstractions)
1. `Room` - 57 edges
2. `attachSockets()` - 21 edges
3. `el()` - 19 edges
4. `clearAll()` - 14 edges
5. `el()` - 13 edges
6. `content()` - 12 edges
7. `content()` - 11 edges
8. `buildStages()` - 11 edges
9. `seededRng()` - 11 edges
10. `applySnapshot()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/icebreaker.test.js → shared/rng.js
- `README` --conceptually_related_to--> `Railway Deployment`  [INFERRED]
  README.md → .claude-progress.md
- `start()` --indirect_call--> `score()`  [INFERRED]
  public/js/games.js → test/caption.test.js
- `withServer()` --calls--> `createServer()`  [EXTRACTED]
  test/smoke.test.js → server/app.js

## Import Cycles
- None detected.

## Communities (21 total, 5 thin omitted)

### Community 0 - "Game Room Lifecycle"
Cohesion: 0.11
Nodes (5): formatRaw(), ROSTER_BY_KEY, Room, attachSockets(), seededRng()

### Community 1 - "Game Data Aggregation"
Cohesion: 0.09
Nodes (34): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildGameData(), buildReveal(), buildStages(), CAPTION_PROMPTS, clamp() (+26 more)

### Community 2 - "Host Control Validation Script"
Cohesion: 0.07
Nodes (28): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+20 more)

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

### Community 7 - "Multi-Game Integration Tests"
Cohesion: 0.22
Nodes (14): NEEDS_AGGREGATION, addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo() (+6 more)

### Community 8 - "Game Canvas Client Utils"
Cohesion: 0.23
Nodes (15): availHeight(), canvasPos(), clamp(), GameClients, h(), makeCanvas(), polygonPath(), SHAPE_CORNERS (+7 more)

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

## Knowledge Gaps
- **69 isolated node(s):** `NEON`, `GameClients`, `SHAPE_CORNERS`, `socket`, `state` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Game Room Lifecycle` to `Host Control Validation Script`, `Server Bootstrap & Test Harness`, `Multi-Game Integration Tests`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Game Room Lifecycle` to `Host Control Validation Script`, `Project Dependencies`, `Server Bootstrap & Test Harness`, `Multi-Game Integration Tests`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `qrcode` connect `Project Dependencies` to `Game Room Lifecycle`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `NEON`, `GameClients`, `SHAPE_CORNERS` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Game Room Lifecycle` be split into smaller, more focused modules?**
  _Cohesion score 0.11428571428571428 - nodes in this community are weakly interconnected._
- **Should `Game Data Aggregation` be split into smaller, more focused modules?**
  _Cohesion score 0.09371980676328502 - nodes in this community are weakly interconnected._
- **Should `Host Control Validation Script` be split into smaller, more focused modules?**
  _Cohesion score 0.07051282051282051 - nodes in this community are weakly interconnected._