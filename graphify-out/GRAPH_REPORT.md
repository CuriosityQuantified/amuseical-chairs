# Graph Report - amuseical-chairs  (2026-08-09)

## Corpus Check
- 59 files · ~88,950 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 507 nodes · 1168 edges · 36 communities (31 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3b9d0d54`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- caption.test.js
- room.js
- Host UI Lobby Setup
- Player Client Sync UI
- package.json
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
- ciede2000.js
- graphify runbook
- check.mjs
- cups.test.js
- server/games.js
- buildGameData
- metronome.test.js
- feedback.js
- formatRaw
- seededRng
- balance.test.js
- feedback.spec.js
- reveal.test.js

## God Nodes (most connected - your core abstractions)
1. `Room` - 63 edges
2. `seededRng()` - 43 edges
3. `buildGameData()` - 34 edges
4. `computeMetric()` - 23 edges
5. `attachSockets()` - 22 edges
6. `el()` - 19 edges
7. `ROSTER_BY_KEY` - 17 edges
8. `cupsLevel()` - 17 edges
9. `formatRaw()` - 15 edges
10. `clearAll()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/fractions.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/metronome.test.js → server/games.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/icebreaker.test.js → shared/rng.js
- `README` --conceptually_related_to--> `Railway Deployment`  [INFERRED]
  README.md → .claude-progress.md

## Import Cycles
- None detected.

## Communities (36 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.11
Nodes (4): COMPLETION_MODE, Room, sanitizeConfig(), attachSockets()

### Community 1 - "caption.test.js"
Cohesion: 0.13
Nodes (19): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), icebreakerTally(), num(), votesForPool() (+11 more)

### Community 2 - "room.js"
Cohesion: 0.10
Nodes (18): createServer(), __dirname, { httpServer }, DEFAULTS, makeRoomCode(), PER_TURN_SECRET, normalizeError(), normalizeScore() (+10 more)

### Community 3 - "Host UI Lobby Setup"
Cohesion: 0.14
Nodes (31): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+23 more)

### Community 4 - "Player Client Sync UI"
Cohesion: 0.18
Nodes (31): applySnapshot(), banner(), clearAll(), clearAllButBanner(), content(), doSync(), el(), enterRoom() (+23 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (30): express, dependencies, express, qrcode, socket.io, three, description, devDependencies (+22 more)

### Community 6 - "harness.test.js"
Cohesion: 0.22
Nodes (7): letters(), solveScramble(), parseValue(), Bot, botPayload(), sleep(), TEST_CONFIG

### Community 7 - "multistage.test.js"
Cohesion: 0.22
Nodes (14): NEEDS_AGGREGATION, addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo() (+6 more)

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

### Community 23 - "check.mjs"
Cohesion: 0.10
Nodes (18): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+10 more)

### Community 24 - "cups.test.js"
Cohesion: 0.10
Nodes (26): clamp(), computeMetric(), cupsCount(), cupsLevel(), cupsSwapMs(), pairsFor(), score(), build() (+18 more)

### Community 27 - "server/games.js"
Cohesion: 0.22
Nodes (13): CAPTION_PROMPTS, ICEBREAKER_PROMPTS, METRONOME_INTERVALS, pickContent(), ROOM_QUESTIONS, SENTENCES, pick(), randInt() (+5 more)

### Community 28 - "buildGameData"
Cohesion: 0.24
Nodes (11): buildGameData(), MULTI_STAGE, areaRatio(), areaTrials(), RATIOS, SHAPES, shuffled(), round() (+3 more)

### Community 29 - "metronome.test.js"
Cohesion: 0.18
Nodes (9): ROSTER_BY_KEY, onlyCups(), onlyCups(), build(), FAST, onlyMetronome(), score(), sleep() (+1 more)

### Community 30 - "feedback.js"
Cohesion: 0.38
Nodes (11): anagramFeedback(), areaFeedback(), bisectFeedback(), blank(), clamp(), dotsFeedback(), fractionsFeedback(), gridflashFeedback() (+3 more)

### Community 31 - "formatRaw"
Cohesion: 0.24
Nodes (8): formatRaw(), findPair(), fractionsPairs(), MAGNITUDE_POOL, POWER_POOL, CONFIG, round(), score()

### Community 32 - "seededRng"
Cohesion: 0.38
Nodes (7): anagramRounds(), isTrivialRotation(), scrambleWord(), WORDS_BY_LENGTH, seededRng(), CONFIG, round()

### Community 33 - "balance.test.js"
Cohesion: 0.40
Nodes (8): balanceControl(), balanceSchedule(), balanceState(), balanceStep(), CONFIG, play(), round(), steerTowardFall()

### Community 34 - "feedback.spec.js"
Cohesion: 0.47
Nodes (3): assertFeedbackShown(), nextBtn(), panel()

### Community 35 - "reveal.test.js"
Cohesion: 0.70
Nodes (4): ROSTER, addPlayer(), anagramRoom(), stubIo()

## Knowledge Gaps
- **101 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+96 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `seededRng`, `room.js`, `reveal.test.js`, `multistage.test.js`, `cups.test.js`, `metronome.test.js`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `room.js`, `package.json`, `multistage.test.js`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `qrcode` connect `package.json` to `Room`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _101 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.10839598997493734 - nodes in this community are weakly interconnected._
- **Should `caption.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12615384615384614 - nodes in this community are weakly interconnected._
- **Should `room.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0967741935483871 - nodes in this community are weakly interconnected._