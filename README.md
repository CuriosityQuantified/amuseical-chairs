# Amuse-ical Chairs

A browser party game for meetings, classrooms, and groups. One person projects the host screen; everyone else plays on a phone or laptop. The room competes through simultaneous skill games, then finishes with a clock-synced musical-chairs reaction tournament.

**Play:** [amuseical.com](https://amuseical.com)

**Host:** [amuseical.com/host.html](https://amuseical.com/host.html)

## How it works

1. The host creates a room and projects the QR code
2. Up to 30 players join with the four-letter code
3. The host chooses a round length and enables the games they want
4. Everyone plays each enabled game at the same time
5. Scores are normalized to 0–1000 within each game, so different skills can share one leaderboard
6. The session ends with musical chairs: the slowest reaction loses a chair each round, and final placement earns up to 3000 bonus points

There are no accounts or permanent profiles. Rooms live in memory and disappear after the session.

### Solo practice

Open the player page and choose **Practice solo** to try any game without creating a hosted room. The host lobby can also launch an unscored test with whoever has joined.

## Games

The current roster has 22 games across perception, timing, memory, attention, social play, language, motor control, and numerical reasoning.

| Category | Games |
|---|---|
| Perceptual | RGB Color Match, Odd One Out, Bisect the Line, Proportion Sense, Trace the Shape |
| Numerical | Dots in the Jar, Fraction Face-Off |
| Timing | Stop the Clock, Metronome Blackout |
| Memory | Grid Flash, Vanishing Tray |
| Attention | Follow the Cup, Stroop Rush |
| Social | Read the Room, Caption Battle, Icebreaker |
| Language | Anagram Rush, Word Hunt |
| Motor | Typing Sprint, Space Mash, Slingshot, Balance the Beam |

Anagram Rush and Word Hunt are off by default. The other 20 games start enabled and can be switched off in the host lobby.

Caption Battle and Icebreaker are multi-stage games built from the room's own submissions. Player-authored text is normalized server-side, displayed anonymously where appropriate, and can be removed from every screen by the host.

## Scoring and fairness

- Each game uses a seeded server-generated round, so every player receives the same content
- Raw results are normalized against only the players who attempted that game
- Missing a game scores 0 but does not remove the player
- The musical-chairs finale uses server-time synchronization so network latency does not become reaction time
- Reconnecting restores identity and score through a private room-lifetime credential; the public player ID is never accepted as proof of ownership
- Color-dependent interactions include labels, textures, initials, or other non-color cues
- Reduced-motion preferences are supported without changing seeds or scoring

## Run locally

Requires Node.js 20 or newer.

```bash
git clone https://github.com/CuriosityQuantified/amuseical-chairs.git
cd amuseical-chairs
npm ci
npm start
```

Open:

- Player: [http://localhost:3000](http://localhost:3000)
- Host: [http://localhost:3000/host.html](http://localhost:3000/host.html)
- Health check: [http://localhost:3000/healthz](http://localhost:3000/healthz)

The server respects `PORT` in hosted environments.

## Development

The application has no frontend build step. Express serves vanilla ES modules, CSS, Canvas/WebGL game clients, and shared deterministic game logic directly to the browser. Socket.IO carries room state, submissions, host controls, reconnects, and clock synchronization.

```text
server/       Express, Socket.IO handlers, room state machine, scoring
shared/       deterministic logic shared by server, browser, and tests
public/       host UI, player UI, tutorials, and game clients
test/         unit, integration, security, accessibility, and bot tests
tests/e2e/    Playwright browser flows
docs/         design audits, security evidence, and graphify runbook
scripts/      repository checks, graph lock, and security assessment
graphify-out/ committed codebase knowledge graph
```

All room state is process-local and ephemeral. Run one application instance unless you add shared state and a Socket.IO adapter.

### Commands

```bash
npm test             # unit/integration suite and 20-bot session harness
npm run test:e2e     # Playwright flows in Chromium
npm run check        # source, roster, config, accessibility, and graph checks
npm run graph        # refresh the committed AST knowledge graph
npm run graph:report # show the graph's highest-connectivity nodes
npm run security:assess -- --target https://amuseical.com
```

CI runs syntax/server smoke tests, graph freshness checks, the full suite on Node 20/22/24, Playwright, and a production dependency audit.

## Security

The server applies a restrictive Content Security Policy, HSTS, clickjacking and MIME protections, a strict referrer policy, a restrictive permissions policy, Socket.IO origin checks, application and transport payload limits, per-event quotas, and failed-join throttling. Player reconnect credentials are generated server-side and never broadcast in room snapshots.

The repository also includes a bounded external assessment harness. It checks TLS, HTTP headers, CORS, sensitive-path exposure, browser errors, Socket.IO authorization, and production dependencies without brute force, load testing, or destructive actions.

- [Assessment methodology](docs/security/README.md)
- [Latest deployed assessment](docs/security/assessment-latest.md)

The latest committed assessment observed 43 passing checks, one informational edge-managed header disclosure, and no critical, high, medium, or low findings. That result describes a limited point-in-time scope, not proof that the application has no vulnerabilities.

## Deployment

Deploy with:

```bash
npm ci
npm start
```

Use a host that supports long-lived WebSocket connections, such as Railway, Render, or Fly.io. Set `PORT` if the platform does not inject it. Serverless request handlers are a poor fit because active rooms and clock synchronization require a persistent process.

Production currently runs at [amuseical.com](https://amuseical.com).

## Repository knowledge graph

This repository commits a [Graphify](https://github.com/Graphify-Labs/graphify) graph under `graphify-out/`. After changing indexed files, refresh it before committing:

```bash
uv tool install "graphifyy[mcp]"   # once per machine
npm run graph:setup                 # install project integration and hooks
npm run graph                       # refresh code nodes and the freshness lock
```

Useful queries:

```bash
graphify query "how does player reconnect authentication work?"
graphify explain "Room"
graphify affected "seededRng()"
```

See [docs/graphify-runbook.md](docs/graphify-runbook.md) for setup and maintenance details.

## Contributing

1. Branch from `main`
2. Add regression coverage for behavior changes
3. Run `npm test`, `npm run test:e2e`, and `npm run check`
4. Run `npm run graph` after changing indexed files
5. Open a pull request and wait for every CI job to pass

When adding a game, update the server roster, browser implementation, tutorial, scoring tests, and repository checks together. Hosted game settings are intentionally limited to duration and per-game toggles.

## License

MIT
