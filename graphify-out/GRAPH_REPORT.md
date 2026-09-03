# Graph Report - amuseical-chairs  (2026-09-03)

## Corpus Check
- 91 files · ~134,900 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 724 nodes · 1608 edges · 60 communities (54 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a73e3fe2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Room
- caption.test.js
- harness.test.js
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
- roster.test.js
- feedback.spec.js
- strix-d869-report.md
- Reduced Motion Accessibility (issue #52)
- formatRaw
- cups.test.js
- Security assessment harness
- Issue #93 Fallback Review Record
- strix-bac3-report.md
- computeMetric
- room.js
- seededRng
- buildGameData
- scrape-flags.mjs
- server/games.js
- balance.test.js
- room.test.js
- redemption.test.js
- Bot
- normalize.js
- makeRoomCode

## God Nodes (most connected - your core abstractions)
1. `Room` - 76 edges
2. `seededRng()` - 54 edges
3. `buildGameData()` - 44 edges
4. `computeMetric()` - 33 edges
5. `attachSockets()` - 32 edges
6. `ROSTER_BY_KEY` - 21 edges
7. `el()` - 20 edges
8. `formatRaw()` - 18 edges
9. `renderHostPhase()` - 17 edges
10. `cupsLevel()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/balance.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/fractions.test.js → server/games.js
- `score()` --calls--> `computeMetric()`  [EXTRACTED]
  test/metronome.test.js → server/games.js
- `wrong()` --calls--> `cupsLevel()`  [EXTRACTED]
  test/cups.test.js → shared/cups.js
- `rng()` --calls--> `seededRng()`  [EXTRACTED]
  test/caption.test.js → shared/rng.js

## Import Cycles
- None detected.

## Communities (60 total, 6 thin omitted)

### Community 0 - "Room"
Cohesion: 0.07
Nodes (15): clientScoredGameAllowed(), PER_TURN_SECRET, pickHostEditableConfig(), Room, sanitizeConfig(), attachSockets(), clientAddress(), failedJoinAllowed() (+7 more)

### Community 1 - "caption.test.js"
Cohesion: 0.13
Nodes (18): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildStages(), icebreakerTally(), num(), votesForPool(), cleanEntryText() (+10 more)

### Community 2 - "harness.test.js"
Cohesion: 0.20
Nodes (11): anagramRounds(), isTrivialRotation(), letters(), scrambleWord(), solveScramble(), WORDS_BY_LENGTH, parseValue(), CONFIG (+3 more)

### Community 3 - "host.js"
Cohesion: 0.13
Nodes (38): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+30 more)

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
Cohesion: 0.24
Nodes (13): addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo(), sleep() (+5 more)

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
Cohesion: 0.10
Nodes (18): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+10 more)

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
Cohesion: 0.18
Nodes (15): cupsCount(), cupsLevel(), cupsSwapMs(), pairsFor(), build(), correct(), cupsRoom(), EXPECTED_MS (+7 more)

### Community 29 - "ciede2000.js"
Cohesion: 0.50
Nodes (5): ciede2000(), ciede2000Rgb(), deg(), rad(), rgbToLab()

### Community 30 - "security.test.js"
Cohesion: 0.17
Nodes (12): allowedSocketOrigin(), CONTENT_SECURITY_POLICY, createServer(), __dirname, { httpServer }, connectSocket(), emitAck(), execFileAsync (+4 more)

### Community 32 - "reduced-motion.test.js"
Cohesion: 0.31
Nodes (6): prefersReducedMotion(), setReducedMotionOverride(), ROOT, SERVER_AND_SHARED_FILES, SIMPLE_KEYS, withFakeWindow()

### Community 33 - "roster.test.js"
Cohesion: 0.15
Nodes (12): MULTI_STAGE, NEEDS_AGGREGATION, ROSTER_BY_KEY, build(), FAST, onlyMetronome(), score(), sleep() (+4 more)

### Community 34 - "feedback.spec.js"
Cohesion: 0.48
Nodes (4): assertFeedbackShown(), continueTurn(), nextBtn(), panel()

### Community 35 - "strix-d869-report.md"
Cohesion: 0.20
Nodes (9): Executive Summary, Executive Summary, Methodology, Methodology, Recommendations, Recommendations, Security Penetration Test Report, Technical Analysis (+1 more)

### Community 37 - "Reduced Motion Accessibility (issue #52)"
Cohesion: 0.33
Nodes (5): Decorative animations (gated on `prefersReducedMotion()`), Detection point, Essential motion (NOT gated — motion IS the mechanic or is functional), Guarantee, Reduced Motion Accessibility (issue #52)

### Community 38 - "formatRaw"
Cohesion: 0.24
Nodes (8): formatRaw(), findPair(), fractionsPairs(), MAGNITUDE_POOL, POWER_POOL, CONFIG, round(), score()

### Community 39 - "cups.test.js"
Cohesion: 0.21
Nodes (11): build(), correct(), cupsRoom(), EXPECTED_MS, FAST, onlyCups(), perfect(), sleep() (+3 more)

### Community 40 - "Security assessment harness"
Cohesion: 0.50
Nodes (3): Interpretation, Run locally, Security assessment harness

### Community 41 - "Issue #93 Fallback Review Record"
Cohesion: 0.33
Nodes (5): 1. Implementation and CI diagnosis/fix, 2. Code review, 3. Code simplification, 4. Security review, Issue #93 Fallback Review Record

### Community 42 - "strix-bac3-report.md"
Cohesion: 0.20
Nodes (9): Executive Summary, Executive Summary, Methodology, Methodology, Recommendations, Recommendations, Security Penetration Test Report, Technical Analysis (+1 more)

### Community 43 - "computeMetric"
Cohesion: 0.21
Nodes (13): clamp(), computeMetric(), buildGrid(), DICE, gridHasPath(), scoreWord(), solveGrid(), WORDLIST (+5 more)

### Community 44 - "room.js"
Cohesion: 0.21
Nodes (9): buildReveal(), ROSTER, COMPETITIVE_CLIENT_SCORING_DISABLED, DEFAULTS, newReconnectToken(), reconnectTokenMatches(), addPlayer(), anagramRoom() (+1 more)

### Community 45 - "seededRng"
Cohesion: 0.25
Nodes (10): seededRng(), assertLabelParity(), COLOR_NAMES, PALETTE, stroopSequence(), chairsJs, gamesJs, ROOT (+2 more)

### Community 47 - "buildGameData"
Cohesion: 0.33
Nodes (8): buildGameData(), pickContent(), areaRatio(), areaTrials(), RATIOS, SHAPES, shuffled(), round()

### Community 49 - "scrape-flags.mjs"
Cohesion: 0.27
Nodes (10): ASSETS, curl, fetchBytes(), isPng(), main(), MANIFEST, parseFlagTable(), ROOT (+2 more)

### Community 50 - "server/games.js"
Cohesion: 0.19
Nodes (15): CAPTION_PROMPTS, COMPLETION_MODE, ICEBREAKER_PROMPTS, METRONOME_INTERVALS, ROOM_QUESTIONS, SENTENCES, flagRounds(), validFlagChoices() (+7 more)

### Community 51 - "balance.test.js"
Cohesion: 0.35
Nodes (9): balanceControl(), balanceSchedule(), balanceState(), balanceStep(), CONFIG, play(), round(), score() (+1 more)

### Community 53 - "room.test.js"
Cohesion: 0.22
Nodes (4): ALL_BLOCKED, FAST, sleep(), waitFor()

### Community 54 - "redemption.test.js"
Cohesion: 0.48
Nodes (4): createRedemptionRun(), scoreRedemptionReport(), fakeClock(), run()

### Community 57 - "normalize.js"
Cohesion: 0.90
Nodes (3): normalizeError(), normalizeScore(), percentile()

## Knowledge Gaps
- **178 isolated node(s):** `graphify-mcp`, `name`, `version`, `description`, `type` (+173 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Room` to `roster.test.js`, `harness.test.js`, `cups.test.js`, `multistage.test.js`, `computeMetric`, `room.js`, `seededRng`, `server/games.js`, `room.test.js`, `cups-ten-level.test.js`, `security.test.js`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Room` to `makeRoomCode`, `room.js`, `scripts`, `security.test.js`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `qrcode` connect `scripts` to `Room`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `name`, `version` to the rest of the system?**
  _178 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.07436708860759493 - nodes in this community are weakly interconnected._
- **Should `caption.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `host.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13170731707317074 - nodes in this community are weakly interconnected._