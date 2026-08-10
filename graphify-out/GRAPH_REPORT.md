# Graph Report - amuseical-chairs  (2026-08-10)

## Corpus Check
- 69 files · ~104,831 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 568 nodes · 1312 edges · 32 communities (27 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `108b5e27`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- formatRaw
- room.js
- Host UI Lobby Setup
- Player Client Sync UI
- package.json
- Feature ideation & application review — issue #36
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
- graphify runbook
- Color-cue audit — issue #53 (colorblind support)
- ciede2000.js
- server/games.js
- cups.test.js
- harness.test.js
- reduced-motion.test.js
- feedback.spec.js
- Reduced Motion Accessibility (issue #52)

## God Nodes (most connected - your core abstractions)
1. `Room` - 68 edges
2. `seededRng()` - 53 edges
3. `buildGameData()` - 42 edges
4. `computeMetric()` - 31 edges
5. `attachSockets()` - 25 edges
6. `ROSTER_BY_KEY` - 20 edges
7. `el()` - 19 edges
8. `formatRaw()` - 17 edges
9. `cupsLevel()` - 17 edges
10. `clearAll()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `buildGameData()` --indirect_call--> `areaRatio()`  [INFERRED]
  server/games.js → shared/area.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups-ten-level.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups.test.js → server/games.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/icebreaker.test.js → shared/rng.js

## Import Cycles
- None detected.

## Communities (32 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.10
Nodes (5): COMPLETION_MODE, PER_TURN_SECRET, Room, sanitizeConfig(), attachSockets()

### Community 1 - "formatRaw"
Cohesion: 0.12
Nodes (21): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), clamp(), formatRaw(), icebreakerTally() (+13 more)

### Community 2 - "room.js"
Cohesion: 0.05
Nodes (34): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+26 more)

### Community 3 - "Host UI Lobby Setup"
Cohesion: 0.14
Nodes (31): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+23 more)

### Community 4 - "Player Client Sync UI"
Cohesion: 0.18
Nodes (31): applySnapshot(), banner(), clearAll(), clearAllButBanner(), content(), doSync(), el(), enterRoom() (+23 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (30): express, dependencies, express, qrcode, socket.io, three, description, devDependencies (+22 more)

### Community 6 - "Feature ideation & application review — issue #36"
Cohesion: 0.22
Nodes (8): Architecture summary (as reviewed), Child issues created, Explicitly rejected / merged ideas (and why), Feature ideation & application review — issue #36, Methodology, Notes for implementers, Open decisions carried into the child issues, Out of scope (by design) — honored by every proposal

### Community 7 - "multistage.test.js"
Cohesion: 0.24
Nodes (13): addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo(), sleep() (+5 more)

### Community 8 - "js/games.js"
Cohesion: 0.24
Nodes (15): availHeight(), canvasPos(), clamp(), GameClients, h(), makeCanvas(), polygonPath(), SHAPE_CORNERS (+7 more)

### Community 9 - "tutorials.js"
Cohesion: 0.17
Nodes (14): box(), C, clamp01(), cursor(), drawPolyline(), ease(), rr(), SCATTER (+6 more)

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

### Community 22 - "graphify runbook"
Cohesion: 0.12
Nodes (15): 0. Quickstart, 1. Install, 2. Write `.graphifyignore` before you extract, 3. Build the graph, 4. Decide what to commit, 5. Make it get used: MCP, not bash, 6. Keep it current, 7. The freshness gate (+7 more)

### Community 23 - "Color-cue audit — issue #53 (colorblind support)"
Cohesion: 0.40
Nodes (4): Change set (bounded), Classification, Color-cue audit — issue #53 (colorblind support), Non-goals honored

### Community 24 - "ciede2000.js"
Cohesion: 0.50
Nodes (5): ciede2000(), ciede2000Rgb(), deg(), rad(), rgbToLab()

### Community 27 - "server/games.js"
Cohesion: 0.05
Nodes (77): buildGameData(), CAPTION_PROMPTS, computeMetric(), ICEBREAKER_PROMPTS, METRONOME_INTERVALS, MULTI_STAGE, NEEDS_AGGREGATION, pickContent() (+69 more)

### Community 28 - "cups.test.js"
Cohesion: 0.11
Nodes (22): cupsCount(), cupsLevel(), cupsSwapMs(), pairsFor(), build(), correct(), EXPECTED_MS, FAST (+14 more)

### Community 30 - "harness.test.js"
Cohesion: 0.12
Nodes (22): createServer(), __dirname, { httpServer }, areaRatio(), anagramFeedback(), areaFeedback(), bisectFeedback(), blank() (+14 more)

### Community 32 - "reduced-motion.test.js"
Cohesion: 0.31
Nodes (6): prefersReducedMotion(), setReducedMotionOverride(), ROOT, SERVER_AND_SHARED_FILES, SIMPLE_KEYS, withFakeWindow()

### Community 34 - "feedback.spec.js"
Cohesion: 0.48
Nodes (4): assertFeedbackShown(), continueTurn(), nextBtn(), panel()

### Community 37 - "Reduced Motion Accessibility (issue #52)"
Cohesion: 0.33
Nodes (5): Decorative animations (gated on `prefersReducedMotion()`), Detection point, Essential motion (NOT gated — motion IS the mechanic or is functional), Guarantee, Reduced Motion Accessibility (issue #52)

## Knowledge Gaps
- **122 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+117 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `room.js`, `server/games.js`, `cups.test.js`, `multistage.test.js`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `room.js`, `package.json`, `harness.test.js`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `qrcode` connect `package.json` to `Room`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _122 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.10100475938656796 - nodes in this community are weakly interconnected._
- **Should `formatRaw` be split into smaller, more focused modules?**
  _Cohesion score 0.1164021164021164 - nodes in this community are weakly interconnected._
- **Should `room.js` be split into smaller, more focused modules?**
  _Cohesion score 0.054426705370101594 - nodes in this community are weakly interconnected._