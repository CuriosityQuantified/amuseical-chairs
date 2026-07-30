# Graph Report - .  (2026-07-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 361 nodes · 784 edges · 21 communities (18 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.66)
- Token cost: 37,717 input · 283 output

## Graph Freshness
- Built from commit: `e789c45b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Game Room Lifecycle
- Game Stage Aggregation
- Host UI Panel
- Player UI Sync
- Package Dependencies
- Server Bootstrap & Roster
- Host Control Guardrails Check
- Progress & Deployment Notes
- Game Canvas Rendering
- Tutorial Drawing Animations
- Multistage Test Harness
- Musical Chairs Rendering
- Color Difference Utility
- Answer Clustering Logic
- Redemption Run Scoring
- Score Normalization Utility
- CI Pipeline Config
- Clock Sync Utility
- Press Counter Utility
- Host Screen UI
- Player Join Screen

## God Nodes (most connected - your core abstractions)
1. `Room` - 57 edges
2. `attachSockets()` - 21 edges
3. `el()` - 19 edges
4. `clearAll()` - 14 edges
5. `el()` - 13 edges
6. `content()` - 12 edges
7. `content()` - 11 edges
8. `buildStages()` - 11 edges
9. `seededRng()` - 11 edges
10. `applySnapshot()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Icebreaker game (README)` --semantically_similar_to--> `Icebreaker game (progress notes)`  [INFERRED] [semantically similar]
  README.md → .claude-progress.md
- `Caption Battle game (README)` --semantically_similar_to--> `Caption Battle game (progress notes)`  [INFERRED] [semantically similar]
  README.md → .claude-progress.md
- `Musical chairs finale (README)` --semantically_similar_to--> `Musical chairs bonus finale (progress notes)`  [INFERRED] [semantically similar]
  README.md → .claude-progress.md
- `Deployment options (README)` --semantically_similar_to--> `Railway deployment`  [INFERRED] [semantically similar]
  README.md → .claude-progress.md
- `Host config rule (README)` --semantically_similar_to--> `Host config lockdown (three layers)`  [INFERRED] [semantically similar]
  README.md → .claude-progress.md

## Import Cycles
- None detected.

## Communities (21 total, 3 thin omitted)

### Community 0 - "Game Room Lifecycle"
Cohesion: 0.11
Nodes (5): ROSTER_BY_KEY, Room, sanitizeConfig(), attachSockets(), seededRng()

### Community 1 - "Game Stage Aggregation"
Cohesion: 0.10
Nodes (35): aggregateCaption(), aggregateGame(), aggregateIcebreaker(), buildGameData(), buildReveal(), buildStages(), CAPTION_PROMPTS, clamp() (+27 more)

### Community 2 - "Host UI Panel"
Cohesion: 0.14
Nodes (31): buildConfigPanel(), confetti(), content(), createRoom(), el(), enabledCount(), enterLobbyUi(), extrasBlock() (+23 more)

### Community 3 - "Player UI Sync"
Cohesion: 0.18
Nodes (31): applySnapshot(), banner(), clearAll(), clearAllButBanner(), content(), doSync(), el(), enterRoom() (+23 more)

### Community 4 - "Package Dependencies"
Cohesion: 0.07
Nodes (26): express, dependencies, express, qrcode, socket.io, three, description, devDependencies (+18 more)

### Community 5 - "Server Bootstrap & Roster"
Cohesion: 0.10
Nodes (13): createServer(), __dirname, ROSTER, { httpServer }, Bot, botPayload(), sleep(), TEST_CONFIG (+5 more)

### Community 6 - "Host Control Guardrails Check"
Cohesion: 0.11
Nodes (17): ALLOWED_HOST_CONTROLS, clientKeys, clientSrc, controlKeys, controlList, files, hostHtml, hostJs (+9 more)

### Community 7 - "Progress & Deployment Notes"
Cohesion: 0.18
Nodes (18): Progress Log (.claude-progress.md), Caption Battle game (progress notes), Musical chairs bonus finale (progress notes), graphify install & graph shape (progress notes), Host config lockdown (three layers), Icebreaker game (progress notes), MULTI_STAGE engine generalization (progress notes), Practice round removed (progress notes) (+10 more)

### Community 8 - "Game Canvas Rendering"
Cohesion: 0.23
Nodes (15): availHeight(), canvasPos(), clamp(), GameClients, h(), makeCanvas(), polygonPath(), SHAPE_CORNERS (+7 more)

### Community 9 - "Tutorial Drawing Animations"
Cohesion: 0.18
Nodes (13): box(), C, clamp01(), cursor(), drawPolyline(), ease(), rr(), SCATTER (+5 more)

### Community 10 - "Multistage Test Harness"
Cohesion: 0.24
Nodes (13): addPlayer(), captionRoom(), FAST, guessAll(), icebreakerRoom(), onlyGames(), recordingIo(), sleep() (+5 more)

### Community 11 - "Musical Chairs Rendering"
Cohesion: 0.36
Nodes (8): chairLayout(), colorFor(), drawAvatar(), drawChairRing(), makeCanvas(), NEON, startChairs(), startChairsSeated()

### Community 12 - "Color Difference Utility"
Cohesion: 0.50
Nodes (5): ciede2000(), ciede2000Rgb(), deg(), rad(), rgbToLab()

### Community 13 - "Answer Clustering Logic"
Cohesion: 0.62
Nodes (5): ARTICLES, clusterAnswers(), levenshtein(), mostCommon(), normalizeAnswer()

### Community 14 - "Redemption Run Scoring"
Cohesion: 0.48
Nodes (4): createRedemptionRun(), scoreRedemptionReport(), fakeClock(), run()

### Community 15 - "Score Normalization Utility"
Cohesion: 0.90
Nodes (3): normalizeError(), normalizeScore(), percentile()

### Community 16 - "CI Pipeline Config"
Cohesion: 0.50
Nodes (4): CI Workflow, CI: Dependency Audit Job, CI: Static Checks Job, CI: Tests Job

### Community 17 - "Clock Sync Utility"
Cohesion: 0.83
Nodes (3): pingOnce(), sleep(), syncClock()

## Knowledge Gaps
- **62 isolated node(s):** `NEON`, `GameClients`, `SHAPE_CORNERS`, `socket`, `state` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Room` connect `Game Room Lifecycle` to `Game Stage Aggregation`, `Multistage Test Harness`, `Server Bootstrap & Roster`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `attachSockets()` connect `Game Room Lifecycle` to `Game Stage Aggregation`, `Multistage Test Harness`, `Package Dependencies`, `Server Bootstrap & Roster`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `qrcode` connect `Package Dependencies` to `Game Room Lifecycle`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `NEON`, `GameClients`, `SHAPE_CORNERS` to the rest of the system?**
  _62 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Game Room Lifecycle` be split into smaller, more focused modules?**
  _Cohesion score 0.11090225563909774 - nodes in this community are weakly interconnected._
- **Should `Game Stage Aggregation` be split into smaller, more focused modules?**
  _Cohesion score 0.09565217391304348 - nodes in this community are weakly interconnected._
- **Should `Host UI Panel` be split into smaller, more focused modules?**
  _Cohesion score 0.14204545454545456 - nodes in this community are weakly interconnected._