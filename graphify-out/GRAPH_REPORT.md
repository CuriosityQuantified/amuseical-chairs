# Graph Report - amuseical-chairs  (2026-08-24)

## Corpus Check
- 80 files · ~132,035 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 765 nodes · 1684 edges · 48 communities (42 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5b49a42`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- caption.test.js
- Bot
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
- Host Screen UI
- Player Join/Play Screen
- security-assessment.mjs
- graphify runbook
- Color-cue audit — issue #53 (colorblind support)
- strix-8f3c-report.md
- cups-solo.spec.js
- feedback.js
- cups.test.js
- ciede2000.js
- security.test.js
- roster.test.js
- reduced-motion.test.js
- buildGameData
- feedback.spec.js
- strix-d869-report.md
- room.js
- Reduced Motion Accessibility (issue #52)
- check.mjs
- rng.js
- Security assessment harness
- balance.test.js
- strix-bac3-report.md
- server/games.js
- seededRng
- metronome.test.js
- fractions.js
- scrape-flags.mjs

## God Nodes (most connected - your core abstractions)
1. `Room` - 75 edges
2. `seededRng()` - 54 edges
3. `buildGameData()` - 44 edges
4. `start()` - 36 edges
5. `computeMetric()` - 32 edges
6. `attachSockets()` - 31 edges
7. `el()` - 19 edges
8. `formatRaw()` - 18 edges
9. `cupsLevel()` - 17 edges
10. `ROSTER_BY_KEY` - 15 edges

## Surprising Connections (you probably didn't know these)
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/balance.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/fractions.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/metronome.test.js → server/games.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/icebreaker.test.js → shared/rng.js

## Import Cycles
- None detected.

## Communities (48 total, 6 thin omitted)

### Community 0 - "Room"
Cohesion: 0.09
Nodes (5): clientScoredGameAllowed(), pickHostEditableConfig(), Room, sanitizeConfig(), attachSockets()

### Community 1 - "caption.test.js"
Cohesion: 0.14
Nodes (19): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), icebreakerTally(), votesForPool(), cleanEntryText() (+11 more)

### Community 3 - "Host UI Lobby Setup"
Cohesion: 0.14
Nodes (31): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+23 more)

### Community 4 - "Player Client Sync UI"
Cohesion: 0.18
Nodes (31): applySnapshot(), banner(), clearAll(), clearAllButBanner(), content(), doSync(), el(), enterRoom() (+23 more)

### Community 5 - "scripts"
Cohesion: 0.06
Nodes (33): express, dependencies, express, qrcode, socket.io, three, description, devDependencies (+25 more)

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

### Community 21 - "security-assessment.mjs"
Cohesion: 0.10
Nodes (40): allowedHosts, allowedOrigins, args, check(), checks, emitAck(), execFileAsync, finding() (+32 more)

### Community 22 - "graphify runbook"
Cohesion: 0.12
Nodes (15): 0. Quickstart, 1. Install, 2. Write `.graphifyignore` before you extract, 3. Build the graph, 4. Decide what to commit, 5. Make it get used: MCP, not bash, 6. Keep it current, 7. The freshness gate (+7 more)

### Community 23 - "Color-cue audit — issue #53 (colorblind support)"
Cohesion: 0.40
Nodes (4): Change set (bounded), Classification, Color-cue audit — issue #53 (colorblind support), Non-goals honored

### Community 24 - "strix-8f3c-report.md"
Cohesion: 0.20
Nodes (9): Executive Summary, Executive Summary, Methodology, Methodology, Recommendations, Recommendations, Security Penetration Test Report, Technical Analysis (+1 more)

### Community 27 - "feedback.js"
Cohesion: 0.28
Nodes (15): anagramFeedback(), AREA_TOL, areaFeedback(), BISECT_TOL, bisectFeedback(), blank(), clamp(), DOTS_TOL (+7 more)

### Community 28 - "cups.test.js"
Cohesion: 0.10
Nodes (30): CUPS_BASE_CUPS, CUPS_FIRST_SWAP_MS, CUPS_LAST_SWAP_MS, CUPS_MAX_CUPS, CUPS_MAX_LEVELS, cupsCount(), cupsLevel(), cupsSwapMs() (+22 more)

### Community 29 - "ciede2000.js"
Cohesion: 0.50
Nodes (5): ciede2000(), ciede2000Rgb(), deg(), rad(), rgbToLab()

### Community 30 - "security.test.js"
Cohesion: 0.17
Nodes (12): allowedSocketOrigin(), CONTENT_SECURITY_POLICY, createServer(), __dirname, { httpServer }, connectSocket(), emitAck(), execFileAsync (+4 more)

### Community 31 - "roster.test.js"
Cohesion: 0.14
Nodes (16): NEEDS_AGGREGATION, ROSTER, anagramRounds(), isTrivialRotation(), letters(), scrambleWord(), solveScramble(), WORDS_BY_LENGTH (+8 more)

### Community 32 - "reduced-motion.test.js"
Cohesion: 0.31
Nodes (6): prefersReducedMotion(), setReducedMotionOverride(), ROOT, SERVER_AND_SHARED_FILES, SIMPLE_KEYS, withFakeWindow()

### Community 33 - "buildGameData"
Cohesion: 0.22
Nodes (12): buildGameData(), pickContent(), AREA_TRIAL_COUNT, areaRatio(), areaTrials(), RATIOS, SHAPES, shuffled() (+4 more)

### Community 34 - "feedback.spec.js"
Cohesion: 0.48
Nodes (4): assertFeedbackShown(), continueTurn(), nextBtn(), panel()

### Community 35 - "strix-d869-report.md"
Cohesion: 0.20
Nodes (9): Executive Summary, Executive Summary, Methodology, Methodology, Recommendations, Recommendations, Security Penetration Test Report, Technical Analysis (+1 more)

### Community 36 - "room.js"
Cohesion: 0.06
Nodes (35): COMPETITIVE_CLIENT_SCORING_DISABLED, DEFAULTS, EMPTY_ROOM_RETENTION_MS, EMPTY_UNSTARTED_RETENTION_MS, EXTEND_MS, makeRoomCode(), newReconnectToken(), PER_TURN_SECRET (+27 more)

### Community 37 - "Reduced Motion Accessibility (issue #52)"
Cohesion: 0.33
Nodes (5): Decorative animations (gated on `prefersReducedMotion()`), Detection point, Essential motion (NOT gated — motion IS the mechanic or is functional), Guarantee, Reduced Motion Accessibility (issue #52)

### Community 38 - "check.mjs"
Cohesion: 0.10
Nodes (18): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+10 more)

### Community 39 - "rng.js"
Cohesion: 0.20
Nodes (12): COMPLETION_MODE, formatRaw(), flagRounds(), FLAGS_OPTIONS, FLAGS_ROUNDS, randInt(), shuffle(), TRAY_GLYPHS (+4 more)

### Community 40 - "Security assessment harness"
Cohesion: 0.50
Nodes (3): Interpretation, Run locally, Security assessment harness

### Community 41 - "balance.test.js"
Cohesion: 0.20
Nodes (17): BALANCE_CTRL_D, BALANCE_CTRL_K, BALANCE_DAMPING, BALANCE_DT, BALANCE_FIRST_NUDGE_MS, BALANCE_GRAVITY, BALANCE_LENGTH, BALANCE_MAX_ANGLE (+9 more)

### Community 42 - "strix-bac3-report.md"
Cohesion: 0.20
Nodes (9): Executive Summary, Executive Summary, Methodology, Methodology, Recommendations, Recommendations, Security Penetration Test Report, Technical Analysis (+1 more)

### Community 43 - "server/games.js"
Cohesion: 0.14
Nodes (20): CAPTION_PROMPTS, clamp(), computeMetric(), ICEBREAKER_PROMPTS, METRONOME_INTERVALS, num(), ROOM_QUESTIONS, SENTENCES (+12 more)

### Community 44 - "seededRng"
Cohesion: 0.24
Nodes (11): ROSTER_BY_KEY, seededRng(), assertLabelParity(), COLOR_NAMES, PALETTE, stroopSequence(), chairsJs, gamesJs (+3 more)

### Community 46 - "metronome.test.js"
Cohesion: 0.20
Nodes (6): MULTI_STAGE, build(), FAST, score(), sleep(), waitFor()

### Community 47 - "fractions.js"
Cohesion: 0.24
Nodes (9): findPair(), FRACTIONS_COUNT, FRACTIONS_PENALTY, fractionsPairs(), MAGNITUDE_POOL, POWER_POOL, CONFIG, round() (+1 more)

### Community 49 - "scrape-flags.mjs"
Cohesion: 0.22
Nodes (12): ASSETS, curl, EXPECTED_FLAGS, fetchBytes(), FLAGS_SOURCE, isPng(), main(), MANIFEST (+4 more)

## Knowledge Gaps
- **185 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+180 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `room.js`, `rng.js`, `multistage.test.js`, `server/games.js`, `seededRng`, `metronome.test.js`, `cups.test.js`, `security.test.js`, `roster.test.js`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `seededRng()` connect `seededRng` to `Room`, `buildGameData`, `caption.test.js`, `reduced-motion.test.js`, `room.js`, `rng.js`, `balance.test.js`, `server/games.js`, `metronome.test.js`, `fractions.js`, `cups.test.js`, `roster.test.js`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `buildGameData()` connect `buildGameData` to `Room`, `reduced-motion.test.js`, `room.js`, `rng.js`, `balance.test.js`, `server/games.js`, `seededRng`, `metronome.test.js`, `fractions.js`, `cups.test.js`, `roster.test.js`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `start()` (e.g. with `frame()` and `confirm()`) actually correct?**
  _`start()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _185 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.09497964721845319 - nodes in this community are weakly interconnected._
- **Should `caption.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13538461538461538 - nodes in this community are weakly interconnected._