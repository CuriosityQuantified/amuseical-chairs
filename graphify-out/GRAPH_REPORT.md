# Graph Report - amuseical-chairs  (2026-08-13)

## Corpus Check
- 72 files · ~113,654 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 631 nodes · 1427 edges · 45 communities (39 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fce84d3c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- server/games.js
- redemption.test.js
- Host UI Lobby Setup
- Player Client Sync UI
- scripts
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
- security-assessment.mjs
- graphify runbook
- Color-cue audit — issue #53 (colorblind support)
- ciede2000.js
- buildGameData
- cups.test.js
- computeMetric
- feedback.js
- reveal.test.js
- reduced-motion.test.js
- app.js
- feedback.spec.js
- seededRng
- room.js
- Reduced Motion Accessibility (issue #52)
- check.mjs
- anagram.test.js
- Security assessment harness
- balance.test.js
- room.test.js
- formatRaw
- Bot

## God Nodes (most connected - your core abstractions)
1. `Room` - 68 edges
2. `seededRng()` - 53 edges
3. `buildGameData()` - 42 edges
4. `computeMetric()` - 31 edges
5. `attachSockets()` - 28 edges
6. `ROSTER_BY_KEY` - 20 edges
7. `el()` - 19 edges
8. `formatRaw()` - 17 edges
9. `cupsLevel()` - 17 edges
10. `clearAll()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `buildGameData()` --indirect_call--> `areaRatio()`  [INFERRED]
  server/games.js → shared/area.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/balance.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups-ten-level.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/metronome.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/tray.test.js → server/games.js

## Import Cycles
- None detected.

## Communities (45 total, 6 thin omitted)

### Community 0 - "Room"
Cohesion: 0.08
Nodes (13): COMPLETION_MODE, makeRoomCode(), PER_TURN_SECRET, Room, sanitizeConfig(), attachSockets(), clientAddress(), failedJoinAllowed() (+5 more)

### Community 1 - "server/games.js"
Cohesion: 0.11
Nodes (26): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), CAPTION_PROMPTS, clamp(), ICEBREAKER_PROMPTS (+18 more)

### Community 2 - "redemption.test.js"
Cohesion: 0.48
Nodes (4): createRedemptionRun(), scoreRedemptionReport(), fakeClock(), run()

### Community 3 - "Host UI Lobby Setup"
Cohesion: 0.14
Nodes (31): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+23 more)

### Community 4 - "Player Client Sync UI"
Cohesion: 0.18
Nodes (31): applySnapshot(), banner(), clearAll(), clearAllButBanner(), content(), doSync(), el(), enterRoom() (+23 more)

### Community 5 - "scripts"
Cohesion: 0.06
Nodes (31): express, dependencies, express, qrcode, socket.io, three, description, devDependencies (+23 more)

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

### Community 21 - "security-assessment.mjs"
Cohesion: 0.10
Nodes (40): allowedHosts, allowedOrigins, args, check(), checks, emitAck(), execFileAsync, finding() (+32 more)

### Community 22 - "graphify runbook"
Cohesion: 0.12
Nodes (15): 0. Quickstart, 1. Install, 2. Write `.graphifyignore` before you extract, 3. Build the graph, 4. Decide what to commit, 5. Make it get used: MCP, not bash, 6. Keep it current, 7. The freshness gate (+7 more)

### Community 23 - "Color-cue audit — issue #53 (colorblind support)"
Cohesion: 0.40
Nodes (4): Change set (bounded), Classification, Color-cue audit — issue #53 (colorblind support), Non-goals honored

### Community 24 - "ciede2000.js"
Cohesion: 0.50
Nodes (5): ciede2000(), ciede2000Rgb(), deg(), rad(), rgbToLab()

### Community 27 - "buildGameData"
Cohesion: 0.21
Nodes (15): buildGameData(), findPair(), fractionsPairs(), MAGNITUDE_POOL, POWER_POOL, pick(), randInt(), shuffle() (+7 more)

### Community 28 - "cups.test.js"
Cohesion: 0.11
Nodes (21): cupsCount(), cupsLevel(), cupsSwapMs(), pairsFor(), build(), correct(), EXPECTED_MS, FAST (+13 more)

### Community 29 - "computeMetric"
Cohesion: 0.20
Nodes (13): computeMetric(), areaRatio(), buildGrid(), DICE, gridHasPath(), scoreWord(), solveGrid(), WORDLIST (+5 more)

### Community 30 - "feedback.js"
Cohesion: 0.35
Nodes (12): anagramFeedback(), areaFeedback(), bisectFeedback(), blank(), clamp(), dotsFeedback(), fractionsFeedback(), gridflashFeedback() (+4 more)

### Community 31 - "reveal.test.js"
Cohesion: 0.43
Nodes (4): ROSTER, addPlayer(), anagramRoom(), stubIo()

### Community 32 - "reduced-motion.test.js"
Cohesion: 0.31
Nodes (6): prefersReducedMotion(), setReducedMotionOverride(), ROOT, SERVER_AND_SHARED_FILES, SIMPLE_KEYS, withFakeWindow()

### Community 33 - "app.js"
Cohesion: 0.18
Nodes (8): allowedSocketOrigin(), CONTENT_SECURITY_POLICY, createServer(), __dirname, { httpServer }, execFileAsync, ROOT, withServer()

### Community 34 - "feedback.spec.js"
Cohesion: 0.48
Nodes (4): assertFeedbackShown(), continueTurn(), nextBtn(), panel()

### Community 35 - "seededRng"
Cohesion: 0.23
Nodes (11): seededRng(), assertLabelParity(), COLOR_NAMES, PALETTE, stroopSequence(), chairsJs, gamesJs, ROOT (+3 more)

### Community 36 - "room.js"
Cohesion: 0.11
Nodes (17): MULTI_STAGE, NEEDS_AGGREGATION, ROSTER_BY_KEY, DEFAULTS, newReconnectToken(), reconnectTokenMatches(), onlyCups(), onlyCups() (+9 more)

### Community 37 - "Reduced Motion Accessibility (issue #52)"
Cohesion: 0.33
Nodes (5): Decorative animations (gated on `prefersReducedMotion()`), Detection point, Essential motion (NOT gated — motion IS the mechanic or is functional), Guarantee, Reduced Motion Accessibility (issue #52)

### Community 38 - "check.mjs"
Cohesion: 0.10
Nodes (18): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+10 more)

### Community 39 - "anagram.test.js"
Cohesion: 0.29
Nodes (8): anagramRounds(), isTrivialRotation(), letters(), scrambleWord(), solveScramble(), WORDS_BY_LENGTH, CONFIG, round()

### Community 40 - "Security assessment harness"
Cohesion: 0.50
Nodes (3): Interpretation, Run locally, Security assessment harness

### Community 41 - "balance.test.js"
Cohesion: 0.35
Nodes (9): balanceControl(), balanceSchedule(), balanceState(), balanceStep(), CONFIG, play(), round(), score() (+1 more)

### Community 42 - "room.test.js"
Cohesion: 0.20
Nodes (6): normalizeError(), normalizeScore(), percentile(), FAST, sleep(), waitFor()

### Community 43 - "formatRaw"
Cohesion: 0.32
Nodes (6): formatRaw(), areaTrials(), RATIOS, SHAPES, shuffled(), round()

## Knowledge Gaps
- **140 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+135 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `seededRng`, `room.js`, `multistage.test.js`, `anagram.test.js`, `room.test.js`, `cups.test.js`, `computeMetric`, `reveal.test.js`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `app.js`, `scripts`, `reveal.test.js`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `qrcode` connect `scripts` to `Room`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _140 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.0841046277665996 - nodes in this community are weakly interconnected._
- **Should `server/games.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11051693404634581 - nodes in this community are weakly interconnected._
- **Should `Host UI Lobby Setup` be split into smaller, more focused modules?**
  _Cohesion score 0.14204545454545456 - nodes in this community are weakly interconnected._