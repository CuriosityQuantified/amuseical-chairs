# Graph Report - amuseical-chairs  (2026-08-09)

## Corpus Check
- 67 files · ~101,533 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 556 nodes · 1286 edges · 37 communities (32 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9b6493f2`
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
- server/games.js
- graphify runbook
- balance.test.js
- harness.test.js
- seededRng
- cups-ten-level.test.js
- cups.test.js
- feedback.js
- computeMetric
- reduced-motion.test.js
- fractions.js
- feedback.spec.js
- anagram.test.js
- Reduced Motion Accessibility (issue #52)

## God Nodes (most connected - your core abstractions)
1. `Room` - 66 edges
2. `seededRng()` - 52 edges
3. `buildGameData()` - 41 edges
4. `computeMetric()` - 30 edges
5. `attachSockets()` - 23 edges
6. `el()` - 19 edges
7. `ROSTER_BY_KEY` - 19 edges
8. `formatRaw()` - 17 edges
9. `cupsLevel()` - 17 edges
10. `clearAll()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `buildGameData()` --indirect_call--> `areaRatio()`  [INFERRED]
  server/games.js → shared/area.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/fractions.test.js → server/games.js
- `wrong()` --calls--> `cupsLevel()`  [EXTRACTED]
  test/cups.test.js → shared/cups.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/icebreaker.test.js → shared/rng.js

## Import Cycles
- None detected.

## Communities (37 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.10
Nodes (5): COMPLETION_MODE, makeRoomCode(), Room, sanitizeConfig(), attachSockets()

### Community 1 - "formatRaw"
Cohesion: 0.12
Nodes (21): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), clamp(), formatRaw(), icebreakerTally() (+13 more)

### Community 2 - "room.js"
Cohesion: 0.06
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
Cohesion: 0.22
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

### Community 21 - "server/games.js"
Cohesion: 0.19
Nodes (12): CAPTION_PROMPTS, ICEBREAKER_PROMPTS, METRONOME_INTERVALS, ROOM_QUESTIONS, SENTENCES, areaRatio(), areaTrials(), RATIOS (+4 more)

### Community 22 - "graphify runbook"
Cohesion: 0.12
Nodes (15): 0. Quickstart, 1. Install, 2. Write `.graphifyignore` before you extract, 3. Build the graph, 4. Decide what to commit, 5. Make it get used: MCP, not bash, 6. Keep it current, 7. The freshness gate (+7 more)

### Community 23 - "balance.test.js"
Cohesion: 0.47
Nodes (7): balanceControl(), balanceSchedule(), balanceState(), balanceStep(), CONFIG, play(), steerTowardFall()

### Community 24 - "harness.test.js"
Cohesion: 0.08
Nodes (24): createServer(), __dirname, { httpServer }, letters(), solveScramble(), ciede2000(), ciede2000Rgb(), deg() (+16 more)

### Community 27 - "seededRng"
Cohesion: 0.20
Nodes (17): buildGameData(), pickContent(), seededRng(), shuffle(), assertLabelParity(), COLOR_NAMES, PALETTE, stroopSequence() (+9 more)

### Community 28 - "cups-ten-level.test.js"
Cohesion: 0.20
Nodes (12): cupsCount(), cupsLevel(), cupsSwapMs(), pairsFor(), build(), correct(), EXPECTED_MS, FAST (+4 more)

### Community 29 - "cups.test.js"
Cohesion: 0.16
Nodes (12): ROSTER_BY_KEY, onlyCups(), build(), correct(), EXPECTED_MS, FAST, onlyCups(), perfect() (+4 more)

### Community 30 - "feedback.js"
Cohesion: 0.35
Nodes (12): anagramFeedback(), areaFeedback(), bisectFeedback(), blank(), clamp(), dotsFeedback(), fractionsFeedback(), gridflashFeedback() (+4 more)

### Community 31 - "computeMetric"
Cohesion: 0.14
Nodes (13): computeMetric(), MULTI_STAGE, NEEDS_AGGREGATION, score(), score(), score(), FAST, score() (+5 more)

### Community 32 - "reduced-motion.test.js"
Cohesion: 0.31
Nodes (6): prefersReducedMotion(), setReducedMotionOverride(), ROOT, SERVER_AND_SHARED_FILES, SIMPLE_KEYS, withFakeWindow()

### Community 33 - "fractions.js"
Cohesion: 0.27
Nodes (8): findPair(), fractionsPairs(), MAGNITUDE_POOL, POWER_POOL, randInt(), CONFIG, round(), score()

### Community 34 - "feedback.spec.js"
Cohesion: 0.48
Nodes (4): assertFeedbackShown(), continueTurn(), nextBtn(), panel()

### Community 35 - "anagram.test.js"
Cohesion: 0.36
Nodes (6): anagramRounds(), isTrivialRotation(), scrambleWord(), WORDS_BY_LENGTH, CONFIG, round()

### Community 37 - "Reduced Motion Accessibility (issue #52)"
Cohesion: 0.33
Nodes (5): Decorative animations (gated on `prefersReducedMotion()`), Detection point, Essential motion (NOT gated — motion IS the mechanic or is functional), Guarantee, Reduced Motion Accessibility (issue #52)

## Knowledge Gaps
- **116 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+111 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `room.js`, `anagram.test.js`, `multistage.test.js`, `harness.test.js`, `seededRng`, `cups-ten-level.test.js`, `cups.test.js`, `computeMetric`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `harness.test.js`, `room.js`, `package.json`, `multistage.test.js`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `qrcode` connect `package.json` to `Room`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.10344827586206896 - nodes in this community are weakly interconnected._
- **Should `formatRaw` be split into smaller, more focused modules?**
  _Cohesion score 0.1164021164021164 - nodes in this community are weakly interconnected._
- **Should `room.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05568627450980392 - nodes in this community are weakly interconnected._