# Graph Report - amuseical-chairs  (2026-08-22)

## Corpus Check
- 73 files · ~112,909 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 705 nodes · 1575 edges · 38 communities (33 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9be39175`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- caption.test.js
- room.test.js
- Host UI Lobby Setup
- Player Client Sync UI
- scripts
- Feature ideation & application review — issue #36
- multistage.test.js
- start
- tutorials.js
- chairs.js
- README
- Answer Clustering Logic
- Graph Lock File
- CI Workflow Jobs
- Clock Sync Utility
- createPressCounter
- Graphify MCP Config
- createRedemptionRun
- Host Screen UI
- Player Join/Play Screen
- security-assessment.mjs
- graphify runbook
- Color-cue audit — issue #53 (colorblind support)
- reveal.test.js
- cups-solo.spec.js
- cups.test.js
- harness.test.js
- reduced-motion.test.js
- feedback.spec.js
- Reduced Motion Accessibility (issue #52)
- check.mjs
- Security assessment harness
- balance.test.js
- room.js
- server/games.js
- HANDOFF — issue #65 security session integrity

## God Nodes (most connected - your core abstractions)
1. `Room` - 72 edges
2. `seededRng()` - 53 edges
3. `buildGameData()` - 42 edges
4. `start()` - 36 edges
5. `computeMetric()` - 30 edges
6. `attachSockets()` - 27 edges
7. `el()` - 19 edges
8. `formatRaw()` - 17 edges
9. `cupsLevel()` - 17 edges
10. `clearAll()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `buildGameData()` --indirect_call--> `areaRatio()`  [INFERRED]
  server/games.js → shared/area.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups-ten-level.test.js → server/games.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/icebreaker.test.js → shared/rng.js
- `README` --conceptually_related_to--> `Railway Deployment`  [INFERRED]
  README.md → .claude-progress.md

## Import Cycles
- None detected.

## Communities (38 total, 5 thin omitted)

### Community 0 - "Room"
Cohesion: 0.08
Nodes (12): clientScoredGameAllowed(), makeRoomCode(), Room, sanitizeConfig(), attachSockets(), clientAddress(), failedJoinAllowed(), failedJoinResponse() (+4 more)

### Community 1 - "caption.test.js"
Cohesion: 0.13
Nodes (20): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), icebreakerTally(), num(), votesForPool() (+12 more)

### Community 2 - "room.test.js"
Cohesion: 0.22
Nodes (4): EXTEND_MS, FAST, sleep(), waitFor()

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
Cohesion: 0.22
Nodes (13): addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo(), sleep() (+5 more)

### Community 8 - "start"
Cohesion: 0.09
Nodes (43): availHeight(), canvasPos(), clamp(), GameClients, h(), makeCanvas(), nearestDist(), polygonPath() (+35 more)

### Community 9 - "tutorials.js"
Cohesion: 0.17
Nodes (15): box(), C, clamp01(), cursor(), drawPolyline(), ease(), rr(), SCATTER (+7 more)

### Community 10 - "chairs.js"
Cohesion: 0.38
Nodes (10): chairLayout(), colorFor(), drawAvatar(), drawChairRing(), makeCanvas(), NEON, startChairs(), draw() (+2 more)

### Community 11 - "README"
Cohesion: 0.43
Nodes (7): Progress Log, Caption Battle, Icebreaker, graphify (Knowledge Graph Tool), graphify MCP Tools, Railway Deployment, README

### Community 12 - "Answer Clustering Logic"
Cohesion: 0.57
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

### Community 18 - "createRedemptionRun"
Cohesion: 0.36
Nodes (7): createRedemptionRun(), armGreen(), finish(), press(), scoreRedemptionReport(), fakeClock(), run()

### Community 21 - "security-assessment.mjs"
Cohesion: 0.10
Nodes (40): allowedHosts, allowedOrigins, args, check(), checks, emitAck(), execFileAsync, finding() (+32 more)

### Community 22 - "graphify runbook"
Cohesion: 0.12
Nodes (15): 0. Quickstart, 1. Install, 2. Write `.graphifyignore` before you extract, 3. Build the graph, 4. Decide what to commit, 5. Make it get used: MCP, not bash, 6. Keep it current, 7. The freshness gate (+7 more)

### Community 23 - "Color-cue audit — issue #53 (colorblind support)"
Cohesion: 0.40
Nodes (4): Change set (bounded), Classification, Color-cue audit — issue #53 (colorblind support), Non-goals honored

### Community 24 - "reveal.test.js"
Cohesion: 0.38
Nodes (4): ROSTER, addPlayer(), anagramRoom(), stubIo()

### Community 28 - "cups.test.js"
Cohesion: 0.10
Nodes (25): COMPLETION_MODE, CUPS_BASE_CUPS, CUPS_FIRST_SWAP_MS, CUPS_LAST_SWAP_MS, CUPS_MAX_CUPS, CUPS_MAX_LEVELS, cupsCount(), cupsLevel() (+17 more)

### Community 30 - "harness.test.js"
Cohesion: 0.08
Nodes (29): allowedSocketOrigin(), CONTENT_SECURITY_POLICY, createServer(), __dirname, { httpServer }, areaRatio(), anagramFeedback(), AREA_TOL (+21 more)

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
Cohesion: 0.11
Nodes (17): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+9 more)

### Community 40 - "Security assessment harness"
Cohesion: 0.50
Nodes (3): Interpretation, Run locally, Security assessment harness

### Community 41 - "balance.test.js"
Cohesion: 0.14
Nodes (21): BALANCE_CTRL_D, BALANCE_CTRL_K, BALANCE_DAMPING, BALANCE_DT, BALANCE_FIRST_NUDGE_MS, BALANCE_GRAVITY, BALANCE_LENGTH, BALANCE_MAX_ANGLE (+13 more)

### Community 42 - "room.js"
Cohesion: 0.27
Nodes (9): COMPETITIVE_CLIENT_SCORING_DISABLED, DEFAULTS, HOST_EDITABLE_CONFIG, newReconnectToken(), PER_TURN_SECRET, reconnectTokenMatches(), normalizeError(), normalizeScore() (+1 more)

### Community 43 - "server/games.js"
Cohesion: 0.06
Nodes (76): buildGameData(), CAPTION_PROMPTS, clamp(), computeMetric(), formatRaw(), ICEBREAKER_PROMPTS, METRONOME_INTERVALS, MULTI_STAGE (+68 more)

### Community 51 - "HANDOFF — issue #65 security session integrity"
Cohesion: 0.29
Nodes (6): Commands and verified results, Completion state, Files for the PR, HANDOFF — issue #65 security session integrity, Remaining ordered actions, Review phases

## Knowledge Gaps
- **152 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+147 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `room.test.js`, `multistage.test.js`, `room.js`, `server/games.js`, `reveal.test.js`, `cups.test.js`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `seededRng()` connect `server/games.js` to `Room`, `caption.test.js`, `reduced-motion.test.js`, `balance.test.js`, `room.js`, `reveal.test.js`, `cups.test.js`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `buildGameData()` connect `server/games.js` to `Room`, `reduced-motion.test.js`, `balance.test.js`, `room.js`, `reveal.test.js`, `cups.test.js`, `harness.test.js`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `start()` (e.g. with `frame()` and `confirm()`) actually correct?**
  _`start()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _152 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `caption.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._