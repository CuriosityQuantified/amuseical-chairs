# Graph Report - amuseical-chairs  (2026-08-09)

## Corpus Check
- 64 files · ~99,351 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 540 nodes · 1262 edges · 32 communities (26 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `426e3b95`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- caption.test.js
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
- ciede2000.js
- graphify runbook
- balance.test.js
- app.js
- server/games.js
- cups.test.js
- Bot
- feedback.js
- feedback.spec.js

## God Nodes (most connected - your core abstractions)
1. `Room` - 66 edges
2. `seededRng()` - 51 edges
3. `buildGameData()` - 40 edges
4. `computeMetric()` - 29 edges
5. `attachSockets()` - 23 edges
6. `el()` - 19 edges
7. `ROSTER_BY_KEY` - 19 edges
8. `formatRaw()` - 17 edges
9. `cupsLevel()` - 17 edges
10. `clearAll()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `onlyCups()` --references--> `ROSTER_BY_KEY`  [EXTRACTED]
  test/cups-ten-level.test.js → server/games.js
- `onlyCups()` --references--> `ROSTER_BY_KEY`  [EXTRACTED]
  test/cups.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/balance.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups-ten-level.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups.test.js → server/games.js

## Import Cycles
- None detected.

## Communities (32 total, 6 thin omitted)

### Community 0 - "Room"
Cohesion: 0.10
Nodes (5): COMPLETION_MODE, makeRoomCode(), Room, sanitizeConfig(), attachSockets()

### Community 1 - "caption.test.js"
Cohesion: 0.13
Nodes (18): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), icebreakerTally(), votesForPool(), cleanEntryText() (+10 more)

### Community 2 - "room.js"
Cohesion: 0.06
Nodes (33): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+25 more)

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
Cohesion: 0.18
Nodes (15): NEEDS_AGGREGATION, PER_TURN_SECRET, addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames() (+7 more)

### Community 8 - "js/games.js"
Cohesion: 0.24
Nodes (15): availHeight(), canvasPos(), clamp(), GameClients, h(), makeCanvas(), polygonPath(), SHAPE_CORNERS (+7 more)

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

### Community 21 - "ciede2000.js"
Cohesion: 0.50
Nodes (5): ciede2000(), ciede2000Rgb(), deg(), rad(), rgbToLab()

### Community 22 - "graphify runbook"
Cohesion: 0.12
Nodes (15): 0. Quickstart, 1. Install, 2. Write `.graphifyignore` before you extract, 3. Build the graph, 4. Decide what to commit, 5. Make it get used: MCP, not bash, 6. Keep it current, 7. The freshness gate (+7 more)

### Community 23 - "balance.test.js"
Cohesion: 0.40
Nodes (8): balanceControl(), balanceSchedule(), balanceState(), balanceStep(), CONFIG, play(), score(), steerTowardFall()

### Community 24 - "app.js"
Cohesion: 0.36
Nodes (5): createServer(), __dirname, { httpServer }, ROOT, withServer()

### Community 27 - "server/games.js"
Cohesion: 0.06
Nodes (72): buildGameData(), CAPTION_PROMPTS, clamp(), computeMetric(), formatRaw(), ICEBREAKER_PROMPTS, METRONOME_INTERVALS, MULTI_STAGE (+64 more)

### Community 28 - "cups.test.js"
Cohesion: 0.11
Nodes (22): cupsCount(), cupsLevel(), cupsSwapMs(), pairsFor(), correct(), EXPECTED_MS, FAST, onlyCups() (+14 more)

### Community 30 - "feedback.js"
Cohesion: 0.38
Nodes (11): anagramFeedback(), areaFeedback(), bisectFeedback(), blank(), clamp(), dotsFeedback(), fractionsFeedback(), gridflashFeedback() (+3 more)

### Community 34 - "feedback.spec.js"
Cohesion: 0.48
Nodes (4): assertFeedbackShown(), continueTurn(), nextBtn(), panel()

## Knowledge Gaps
- **109 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `room.js`, `server/games.js`, `cups.test.js`, `multistage.test.js`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `app.js`, `room.js`, `package.json`, `multistage.test.js`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `qrcode` connect `package.json` to `Room`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.10344827586206896 - nodes in this community are weakly interconnected._
- **Should `caption.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `room.js` be split into smaller, more focused modules?**
  _Cohesion score 0.058673469387755105 - nodes in this community are weakly interconnected._