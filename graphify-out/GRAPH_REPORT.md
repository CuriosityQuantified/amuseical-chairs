# Graph Report - amuseical-chairs  (2026-08-09)

## Corpus Check
- 59 files · ~90,019 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 511 nodes · 1179 edges · 35 communities (30 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3288098d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- caption.test.js
- room.js
- Host UI Lobby Setup
- Player Client Sync UI
- package.json
- cups.test.js
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
- computeMetric
- cups-ten-level.test.js
- server/games.js
- seededRng
- roster.test.js
- harness.test.js
- formatRaw
- anagram.test.js
- balance.test.js
- feedback.spec.js

## God Nodes (most connected - your core abstractions)
1. `Room` - 64 edges
2. `seededRng()` - 43 edges
3. `buildGameData()` - 34 edges
4. `computeMetric()` - 24 edges
5. `attachSockets()` - 23 edges
6. `el()` - 19 edges
7. `ROSTER_BY_KEY` - 17 edges
8. `cupsLevel()` - 17 edges
9. `formatRaw()` - 15 edges
10. `clearAll()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `buildGameData()` --indirect_call--> `areaRatio()`  [INFERRED]
  server/games.js → shared/area.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/fractions.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/tray.test.js → server/games.js
- `wrong()` --calls--> `cupsLevel()`  [EXTRACTED]
  test/cups.test.js → shared/cups.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js

## Import Cycles
- None detected.

## Communities (35 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.10
Nodes (6): COMPLETION_MODE, makeRoomCode(), PER_TURN_SECRET, Room, sanitizeConfig(), attachSockets()

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

### Community 6 - "cups.test.js"
Cohesion: 0.22
Nodes (8): build(), correct(), EXPECTED_MS, FAST, perfect(), sleep(), waitFor(), wrong()

### Community 7 - "multistage.test.js"
Cohesion: 0.24
Nodes (13): addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo(), sleep() (+5 more)

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

### Community 23 - "computeMetric"
Cohesion: 0.29
Nodes (7): clamp(), computeMetric(), num(), score(), score(), score(), score()

### Community 24 - "cups-ten-level.test.js"
Cohesion: 0.20
Nodes (12): cupsCount(), cupsLevel(), cupsSwapMs(), pairsFor(), build(), correct(), EXPECTED_MS, FAST (+4 more)

### Community 27 - "server/games.js"
Cohesion: 0.21
Nodes (16): buildGameData(), CAPTION_PROMPTS, ICEBREAKER_PROMPTS, METRONOME_INTERVALS, pickContent(), ROOM_QUESTIONS, SENTENCES, pick() (+8 more)

### Community 28 - "seededRng"
Cohesion: 0.43
Nodes (6): areaTrials(), RATIOS, SHAPES, shuffled(), seededRng(), round()

### Community 29 - "roster.test.js"
Cohesion: 0.14
Nodes (13): MULTI_STAGE, NEEDS_AGGREGATION, ROSTER_BY_KEY, onlyCups(), onlyCups(), build(), FAST, onlyMetronome() (+5 more)

### Community 30 - "harness.test.js"
Cohesion: 0.12
Nodes (22): createServer(), __dirname, { httpServer }, areaRatio(), anagramFeedback(), areaFeedback(), bisectFeedback(), blank() (+14 more)

### Community 31 - "formatRaw"
Cohesion: 0.24
Nodes (8): formatRaw(), findPair(), fractionsPairs(), MAGNITUDE_POOL, POWER_POOL, CONFIG, round(), score()

### Community 32 - "anagram.test.js"
Cohesion: 0.29
Nodes (8): anagramRounds(), isTrivialRotation(), letters(), scrambleWord(), solveScramble(), WORDS_BY_LENGTH, CONFIG, round()

### Community 33 - "balance.test.js"
Cohesion: 0.47
Nodes (7): balanceControl(), balanceSchedule(), balanceState(), balanceStep(), CONFIG, play(), steerTowardFall()

### Community 34 - "feedback.spec.js"
Cohesion: 0.48
Nodes (4): assertFeedbackShown(), continueTurn(), nextBtn(), panel()

## Knowledge Gaps
- **101 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+96 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `anagram.test.js`, `room.js`, `cups.test.js`, `multistage.test.js`, `cups-ten-level.test.js`, `roster.test.js`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `room.js`, `package.json`, `harness.test.js`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `qrcode` connect `package.json` to `Room`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _101 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.09836065573770492 - nodes in this community are weakly interconnected._
- **Should `caption.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `room.js` be split into smaller, more focused modules?**
  _Cohesion score 0.058673469387755105 - nodes in this community are weakly interconnected._