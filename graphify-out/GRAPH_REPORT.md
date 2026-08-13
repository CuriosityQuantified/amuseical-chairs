# Graph Report - amuseical-chairs  (2026-08-13)

## Corpus Check
- 72 files · ~111,270 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 619 nodes · 1404 edges · 37 communities (32 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ba0c959f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- caption.test.js
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
- server/games.js
- cups.test.js
- normalize.js
- harness.test.js
- reduced-motion.test.js
- feedback.spec.js
- Reduced Motion Accessibility (issue #52)
- check.mjs
- Security assessment harness
- room.test.js

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
- `onlyCups()` --references--> `ROSTER_BY_KEY`  [EXTRACTED]
  test/cups-ten-level.test.js → server/games.js
- `onlyCups()` --references--> `ROSTER_BY_KEY`  [EXTRACTED]
  test/cups.test.js → server/games.js
- `buildGameData()` --indirect_call--> `areaRatio()`  [INFERRED]
  server/games.js → shared/area.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups-ten-level.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups.test.js → server/games.js

## Import Cycles
- None detected.

## Communities (37 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.10
Nodes (5): COMPLETION_MODE, makeRoomCode(), Room, sanitizeConfig(), attachSockets()

### Community 1 - "caption.test.js"
Cohesion: 0.13
Nodes (18): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), icebreakerTally(), votesForPool(), cleanEntryText() (+10 more)

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
Cohesion: 0.20
Nodes (14): PER_TURN_SECRET, addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo() (+6 more)

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

### Community 27 - "server/games.js"
Cohesion: 0.05
Nodes (85): buildGameData(), CAPTION_PROMPTS, clamp(), computeMetric(), formatRaw(), ICEBREAKER_PROMPTS, METRONOME_INTERVALS, MULTI_STAGE (+77 more)

### Community 28 - "cups.test.js"
Cohesion: 0.11
Nodes (22): cupsCount(), cupsLevel(), cupsSwapMs(), pairsFor(), correct(), EXPECTED_MS, FAST, onlyCups() (+14 more)

### Community 29 - "normalize.js"
Cohesion: 0.90
Nodes (3): normalizeError(), normalizeScore(), percentile()

### Community 30 - "harness.test.js"
Cohesion: 0.10
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

### Community 38 - "check.mjs"
Cohesion: 0.10
Nodes (18): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+10 more)

### Community 40 - "Security assessment harness"
Cohesion: 0.50
Nodes (3): Interpretation, Run locally, Security assessment harness

### Community 42 - "room.test.js"
Cohesion: 0.25
Nodes (3): FAST, sleep(), waitFor()

## Knowledge Gaps
- **138 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+133 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `room.test.js`, `server/games.js`, `cups.test.js`, `multistage.test.js`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `server/games.js`, `scripts`, `harness.test.js`, `multistage.test.js`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `qrcode` connect `scripts` to `Room`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _138 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.10163934426229508 - nodes in this community are weakly interconnected._
- **Should `caption.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Host UI Lobby Setup` be split into smaller, more focused modules?**
  _Cohesion score 0.14204545454545456 - nodes in this community are weakly interconnected._