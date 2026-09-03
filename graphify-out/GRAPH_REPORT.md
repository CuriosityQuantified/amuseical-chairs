# Graph Report - amuseical-chairs  (2026-09-03)

## Corpus Check
- 88 files · ~135,024 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 724 nodes · 1605 edges · 59 communities (53 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3932230`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- caption.test.js
- seededRng
- host.js
- player.js
- scripts
- Feature ideation & application review — issue #36
- multistage.test.js
- js/games.js
- tutorials.js
- chairs.js
- README
- Answer Clustering Logic
- Graph Lock File
- CI Workflow Jobs
- Clock Sync Utility
- presscounter.test.js
- Graphify MCP Config
- check.mjs
- Host Screen UI
- Player Join/Play Screen
- security-assessment.mjs
- graphify runbook
- Color-cue audit — issue #53 (colorblind support)
- strix-8f3c-report.md
- feedback.js
- cups-ten-level.test.js
- ciede2000.js
- security.test.js
- reduced-motion.test.js
- Bot
- feedback.spec.js
- strix-d869-report.md
- Reduced Motion Accessibility (issue #52)
- roster.test.js
- cups.test.js
- Security assessment harness
- Issue #93 Fallback Review Record
- strix-bac3-report.md
- server/games.js
- room.js
- stroop.test.js
- harness.test.js
- flags.test.js
- rng.js
- balance.test.js
- formatRaw
- room.test.js
- Handoff — issue #94
- reveal.test.js
- normalize.js
- host-rejoin.test.js

## God Nodes (most connected - your core abstractions)
1. `Room` - 76 edges
2. `seededRng()` - 54 edges
3. `buildGameData()` - 44 edges
4. `computeMetric()` - 33 edges
5. `attachSockets()` - 32 edges
6. `ROSTER_BY_KEY` - 21 edges
7. `el()` - 20 edges
8. `formatRaw()` - 18 edges
9. `cupsLevel()` - 17 edges
10. `renderHostPhase()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/balance.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups-ten-level.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/cups.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/fractions.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/metronome.test.js → server/games.js

## Import Cycles
- None detected.

## Communities (59 total, 6 thin omitted)

### Community 0 - "Room"
Cohesion: 0.08
Nodes (15): COMPLETION_MODE, clientScoredGameAllowed(), makeRoomCode(), pickHostEditableConfig(), Room, sanitizeConfig(), attachSockets(), clientAddress() (+7 more)

### Community 1 - "caption.test.js"
Cohesion: 0.13
Nodes (19): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildReveal(), buildStages(), icebreakerTally(), num(), votesForPool() (+11 more)

### Community 2 - "seededRng"
Cohesion: 0.21
Nodes (14): buildGameData(), clamp(), areaRatio(), areaTrials(), RATIOS, SHAPES, shuffled(), pick() (+6 more)

### Community 3 - "host.js"
Cohesion: 0.14
Nodes (37): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+29 more)

### Community 4 - "player.js"
Cohesion: 0.18
Nodes (34): applySnapshot(), attemptStoredRejoin(), banner(), clearAll(), clearAllButBanner(), content(), doSync(), el() (+26 more)

### Community 5 - "scripts"
Cohesion: 0.06
Nodes (33): express, dependencies, express, qrcode, socket.io, three, description, devDependencies (+25 more)

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
Cohesion: 0.15
Nodes (15): box(), C, clamp01(), cursor(), drawPolyline(), ease(), rr(), SCATTER (+7 more)

### Community 10 - "chairs.js"
Cohesion: 0.36
Nodes (8): chairLayout(), colorFor(), drawAvatar(), drawChairRing(), makeCanvas(), NEON, startChairs(), startChairsSeated()

### Community 11 - "README"
Cohesion: 0.43
Nodes (7): Progress Log, Caption Battle, Icebreaker, graphify (Knowledge Graph Tool), graphify MCP Tools, Railway Deployment, README

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

### Community 18 - "check.mjs"
Cohesion: 0.11
Nodes (17): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+9 more)

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
Cohesion: 0.38
Nodes (11): anagramFeedback(), areaFeedback(), bisectFeedback(), blank(), clamp(), dotsFeedback(), fractionsFeedback(), gridflashFeedback() (+3 more)

### Community 28 - "cups-ten-level.test.js"
Cohesion: 0.17
Nodes (16): cupsCount(), cupsLevel(), cupsSwapMs(), pairsFor(), build(), correct(), cupsRoom(), EXPECTED_MS (+8 more)

### Community 29 - "ciede2000.js"
Cohesion: 0.50
Nodes (5): ciede2000(), ciede2000Rgb(), deg(), rad(), rgbToLab()

### Community 30 - "security.test.js"
Cohesion: 0.17
Nodes (12): allowedSocketOrigin(), CONTENT_SECURITY_POLICY, createServer(), __dirname, { httpServer }, connectSocket(), emitAck(), execFileAsync (+4 more)

### Community 32 - "reduced-motion.test.js"
Cohesion: 0.31
Nodes (6): prefersReducedMotion(), setReducedMotionOverride(), ROOT, SERVER_AND_SHARED_FILES, SIMPLE_KEYS, withFakeWindow()

### Community 34 - "feedback.spec.js"
Cohesion: 0.48
Nodes (4): assertFeedbackShown(), continueTurn(), nextBtn(), panel()

### Community 35 - "strix-d869-report.md"
Cohesion: 0.20
Nodes (9): Executive Summary, Executive Summary, Methodology, Methodology, Recommendations, Recommendations, Security Penetration Test Report, Technical Analysis (+1 more)

### Community 37 - "Reduced Motion Accessibility (issue #52)"
Cohesion: 0.33
Nodes (5): Decorative animations (gated on `prefersReducedMotion()`), Detection point, Essential motion (NOT gated — motion IS the mechanic or is functional), Guarantee, Reduced Motion Accessibility (issue #52)

### Community 38 - "roster.test.js"
Cohesion: 0.15
Nodes (12): MULTI_STAGE, NEEDS_AGGREGATION, ROSTER_BY_KEY, build(), FAST, onlyMetronome(), score(), sleep() (+4 more)

### Community 39 - "cups.test.js"
Cohesion: 0.19
Nodes (12): build(), correct(), cupsRoom(), EXPECTED_MS, FAST, onlyCups(), perfect(), score() (+4 more)

### Community 40 - "Security assessment harness"
Cohesion: 0.50
Nodes (3): Interpretation, Run locally, Security assessment harness

### Community 41 - "Issue #93 Fallback Review Record"
Cohesion: 0.33
Nodes (5): 1. Implementation and CI diagnosis/fix, 2. Code review, 3. Code simplification, 4. Security review, Issue #93 Fallback Review Record

### Community 42 - "strix-bac3-report.md"
Cohesion: 0.20
Nodes (9): Executive Summary, Executive Summary, Methodology, Methodology, Recommendations, Recommendations, Security Penetration Test Report, Technical Analysis (+1 more)

### Community 43 - "server/games.js"
Cohesion: 0.20
Nodes (15): CAPTION_PROMPTS, computeMetric(), ICEBREAKER_PROMPTS, METRONOME_INTERVALS, pickContent(), ROOM_QUESTIONS, SENTENCES, validFlagChoices() (+7 more)

### Community 44 - "room.js"
Cohesion: 0.22
Nodes (9): COMPETITIVE_CLIENT_SCORING_DISABLED, DEFAULTS, HOST_EDITABLE_CONFIG, newReconnectToken(), reconnectTokenMatches(), createRedemptionRun(), scoreRedemptionReport(), fakeClock() (+1 more)

### Community 45 - "stroop.test.js"
Cohesion: 0.23
Nodes (9): assertLabelParity(), COLOR_NAMES, PALETTE, stroopSequence(), chairsJs, gamesJs, ROOT, CONFIG (+1 more)

### Community 47 - "harness.test.js"
Cohesion: 0.23
Nodes (9): letters(), solveScramble(), findPair(), fractionsPairs(), MAGNITUDE_POOL, parseValue(), POWER_POOL, botPayload() (+1 more)

### Community 49 - "flags.test.js"
Cohesion: 0.22
Nodes (10): ASSETS, curl, fetchBytes(), isPng(), main(), MANIFEST, parseFlagTable(), ROOT (+2 more)

### Community 50 - "rng.js"
Cohesion: 0.35
Nodes (8): flagRounds(), randInt(), shuffle(), TRAY_GLYPHS, trayLevel(), traySwapped(), round(), score()

### Community 51 - "balance.test.js"
Cohesion: 0.35
Nodes (9): balanceControl(), balanceSchedule(), balanceState(), balanceStep(), CONFIG, play(), round(), score() (+1 more)

### Community 52 - "formatRaw"
Cohesion: 0.31
Nodes (7): formatRaw(), anagramRounds(), isTrivialRotation(), scrambleWord(), WORDS_BY_LENGTH, CONFIG, round()

### Community 53 - "room.test.js"
Cohesion: 0.22
Nodes (4): ALL_BLOCKED, FAST, sleep(), waitFor()

### Community 54 - "Handoff — issue #94"
Cohesion: 0.29
Nodes (6): Blocker, Handoff — issue #94, Issue specification, READ CONSTRAINTS, Required continuation, State at handoff

### Community 55 - "reveal.test.js"
Cohesion: 0.43
Nodes (4): ROSTER, addPlayer(), anagramRoom(), stubIo()

### Community 56 - "normalize.js"
Cohesion: 0.90
Nodes (3): normalizeError(), normalizeScore(), percentile()

## Knowledge Gaps
- **183 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `roster.test.js`, `cups.test.js`, `multistage.test.js`, `server/games.js`, `room.js`, `stroop.test.js`, `flags.test.js`, `formatRaw`, `room.test.js`, `reveal.test.js`, `host-rejoin.test.js`, `cups-ten-level.test.js`, `security.test.js`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `reveal.test.js`, `scripts`, `security.test.js`, `multistage.test.js`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `qrcode` connect `scripts` to `Room`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `caption.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12615384615384614 - nodes in this community are weakly interconnected._
- **Should `host.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1417004048582996 - nodes in this community are weakly interconnected._