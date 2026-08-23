# Graph Report - amuseical-chairs  (2026-08-22)

## Corpus Check
- 73 files · ~115,587 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 710 nodes · 1596 edges · 48 communities (42 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `746aeda2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- server/games.js
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
- feedback.js
- cups.test.js
- ciede2000.js
- security.test.js
- seededRng
- reduced-motion.test.js
- stroop.test.js
- feedback.spec.js
- roster.test.js
- metronome.test.js
- Reduced Motion Accessibility (issue #52)
- check.mjs
- fractions.js
- Security assessment harness
- balance.test.js
- room.js
- computeMetric
- rng.js
- anagram.test.js
- Bot
- HANDOFF — issue #65 security session integrity

## God Nodes (most connected - your core abstractions)
1. `Room` - 74 edges
2. `seededRng()` - 53 edges
3. `buildGameData()` - 42 edges
4. `start()` - 36 edges
5. `computeMetric()` - 30 edges
6. `attachSockets()` - 30 edges
7. `el()` - 19 edges
8. `formatRaw()` - 17 edges
9. `cupsLevel()` - 17 edges
10. `clearAll()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `buildGameData()` --indirect_call--> `areaRatio()`  [INFERRED]
  server/games.js → shared/area.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/icebreaker.test.js → shared/rng.js
- `README` --conceptually_related_to--> `Railway Deployment`  [INFERRED]
  README.md → .claude-progress.md
- `withServer()` --calls--> `createServer()`  [EXTRACTED]
  test/smoke.test.js → server/app.js

## Import Cycles
- None detected.

## Communities (48 total, 6 thin omitted)

### Community 0 - "Room"
Cohesion: 0.08
Nodes (13): clientScoredGameAllowed(), makeRoomCode(), pickHostEditableConfig(), Room, sanitizeConfig(), attachSockets(), clientAddress(), failedJoinAllowed() (+5 more)

### Community 1 - "server/games.js"
Cohesion: 0.12
Nodes (27): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), CAPTION_PROMPTS, clamp(), formatRaw() (+19 more)

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
Cohesion: 0.24
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

### Community 27 - "feedback.js"
Cohesion: 0.28
Nodes (15): anagramFeedback(), AREA_TOL, areaFeedback(), BISECT_TOL, bisectFeedback(), blank(), clamp(), DOTS_TOL (+7 more)

### Community 28 - "cups.test.js"
Cohesion: 0.10
Nodes (26): COMPLETION_MODE, CUPS_BASE_CUPS, CUPS_FIRST_SWAP_MS, CUPS_LAST_SWAP_MS, CUPS_MAX_CUPS, CUPS_MAX_LEVELS, cupsCount(), cupsLevel() (+18 more)

### Community 29 - "ciede2000.js"
Cohesion: 0.50
Nodes (5): ciede2000(), ciede2000Rgb(), deg(), rad(), rgbToLab()

### Community 30 - "security.test.js"
Cohesion: 0.17
Nodes (12): allowedSocketOrigin(), CONTENT_SECURITY_POLICY, createServer(), __dirname, { httpServer }, connectSocket(), emitAck(), execFileAsync (+4 more)

### Community 31 - "seededRng"
Cohesion: 0.24
Nodes (13): buildGameData(), pickContent(), AREA_TRIAL_COUNT, areaTrials(), RATIOS, SHAPES, shuffled(), pick() (+5 more)

### Community 32 - "reduced-motion.test.js"
Cohesion: 0.31
Nodes (6): prefersReducedMotion(), setReducedMotionOverride(), ROOT, SERVER_AND_SHARED_FILES, SIMPLE_KEYS, withFakeWindow()

### Community 33 - "stroop.test.js"
Cohesion: 0.22
Nodes (10): ROSTER_BY_KEY, assertLabelParity(), COLOR_NAMES, PALETTE, stroopSequence(), chairsJs, gamesJs, ROOT (+2 more)

### Community 34 - "feedback.spec.js"
Cohesion: 0.48
Nodes (4): assertFeedbackShown(), continueTurn(), nextBtn(), panel()

### Community 35 - "roster.test.js"
Cohesion: 0.22
Nodes (10): NEEDS_AGGREGATION, letters(), solveScramble(), areaRatio(), parseValue(), botPayload(), TEST_CONFIG, CONFIG (+2 more)

### Community 36 - "metronome.test.js"
Cohesion: 0.22
Nodes (5): MULTI_STAGE, build(), FAST, sleep(), waitFor()

### Community 37 - "Reduced Motion Accessibility (issue #52)"
Cohesion: 0.33
Nodes (5): Decorative animations (gated on `prefersReducedMotion()`), Detection point, Essential motion (NOT gated — motion IS the mechanic or is functional), Guarantee, Reduced Motion Accessibility (issue #52)

### Community 38 - "check.mjs"
Cohesion: 0.11
Nodes (17): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+9 more)

### Community 39 - "fractions.js"
Cohesion: 0.31
Nodes (7): findPair(), FRACTIONS_COUNT, FRACTIONS_PENALTY, fractionsPairs(), MAGNITUDE_POOL, POWER_POOL, CONFIG

### Community 40 - "Security assessment harness"
Cohesion: 0.50
Nodes (3): Interpretation, Run locally, Security assessment harness

### Community 41 - "balance.test.js"
Cohesion: 0.20
Nodes (17): BALANCE_CTRL_D, BALANCE_CTRL_K, BALANCE_DAMPING, BALANCE_DT, BALANCE_FIRST_NUDGE_MS, BALANCE_GRAVITY, BALANCE_LENGTH, BALANCE_MAX_ANGLE (+9 more)

### Community 42 - "room.js"
Cohesion: 0.27
Nodes (9): COMPETITIVE_CLIENT_SCORING_DISABLED, DEFAULTS, HOST_EDITABLE_CONFIG, newReconnectToken(), PER_TURN_SECRET, reconnectTokenMatches(), normalizeError(), normalizeScore() (+1 more)

### Community 43 - "computeMetric"
Cohesion: 0.16
Nodes (15): computeMetric(), buildGrid(), DICE, gridHasPath(), scoreWord(), solveGrid(), WORDLIST, score() (+7 more)

### Community 44 - "rng.js"
Cohesion: 0.47
Nodes (6): randInt(), shuffle(), TRAY_GLYPHS, TRAY_SLOTS, trayLevel(), traySwapped()

### Community 45 - "anagram.test.js"
Cohesion: 0.43
Nodes (5): anagramRounds(), isTrivialRotation(), scrambleWord(), WORDS_BY_LENGTH, CONFIG

### Community 51 - "HANDOFF — issue #65 security session integrity"
Cohesion: 0.29
Nodes (6): Commands and verified results, Completion state, Files for the PR, HANDOFF — issue #65 security session integrity, Remaining ordered actions, Review phases

## Knowledge Gaps
- **152 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+147 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `stroop.test.js`, `room.test.js`, `metronome.test.js`, `multistage.test.js`, `room.js`, `computeMetric`, `anagram.test.js`, `reveal.test.js`, `cups.test.js`, `security.test.js`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `seededRng()` connect `seededRng` to `Room`, `stroop.test.js`, `server/games.js`, `reduced-motion.test.js`, `metronome.test.js`, `roster.test.js`, `fractions.js`, `balance.test.js`, `room.js`, `computeMetric`, `rng.js`, `anagram.test.js`, `reveal.test.js`, `cups.test.js`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `buildGameData()` connect `seededRng` to `Room`, `server/games.js`, `stroop.test.js`, `roster.test.js`, `metronome.test.js`, `reduced-motion.test.js`, `fractions.js`, `balance.test.js`, `room.js`, `computeMetric`, `rng.js`, `anagram.test.js`, `reveal.test.js`, `cups.test.js`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `start()` (e.g. with `frame()` and `confirm()`) actually correct?**
  _`start()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _152 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.08035087719298245 - nodes in this community are weakly interconnected._
- **Should `server/games.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11596638655462185 - nodes in this community are weakly interconnected._