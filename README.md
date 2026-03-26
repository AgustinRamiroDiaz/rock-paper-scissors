# Rock Paper Scissors - Multiplayer

A real-time multiplayer Rock Paper Scissors game with an authoritative server, lobby system, spectators, and leaderboard.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | [Bun](https://bun.sh) | JavaScript runtime, package manager, test runner |
| Backend | [NestJS 11](https://nestjs.com) | HTTP framework, dependency injection, REST API |
| Realtime | [Colyseus 0.17](https://colyseus.io) | Authoritative game server, WebSocket rooms, state sync |
| Frontend | [Vue 3](https://vuejs.org) + [Vue Router](https://router.vuejs.org) | SPA with reactive UI |
| Client SDK | [@colyseus/sdk](https://www.npmjs.com/package/@colyseus/sdk) | WebSocket client, room state synchronization |
| Build | [Vite](https://vitejs.dev) | Frontend dev server and bundler |
| Linting | [ESLint 10](https://eslint.org) + [typescript-eslint](https://typescript-eslint.io) | Strict TypeScript linting |
| Testing | [Bun test](https://bun.sh/docs/cli/test) + [@colyseus/testing](https://docs.colyseus.io/tools/unit-testing) | Server unit tests |
| E2E Testing | [Playwright](https://playwright.dev) | Browser-based end-to-end tests |

## Architecture

### Monorepo Structure

```
rock-paper-scissors/
├── packages/
│   ├── shared/          # @rps/shared - types, enums, constants
│   ├── server/          # NestJS + Colyseus backend
│   └── client/          # Vue 3 frontend
├── e2e/                 # Playwright browser tests
└── .github/workflows/   # CI pipeline
```

The project uses **Bun workspaces** so all three packages share a single `node_modules` and the `@rps/shared` package is resolved from source (no build step needed).

### Server Architecture

```
bootstrap()
│
├─ BunWebSockets transport      Creates Bun.serve() for WebSocket upgrades
│   └─ Express app               Shared between NestJS and Colyseus
│
├─ NestJS                        Primary framework
│   ├─ LeaderboardController     GET /api/leaderboard
│   ├─ LeaderboardService        In-memory win/loss tracking
│   └─ Colyseus Monitor          GET /monitor (admin dashboard)
│
├─ Colyseus Server               Game transport layer
│   ├─ PostgresDriver            Matchmaker room-cache persistence
│   ├─ LobbyRoom                 Live room listing for the portal
│   └─ RPSRoom                   Authoritative game room
│       ├─ State schema           Synced to all clients automatically
│       ├─ Message handlers       make_choice, play_again, toggle_ready
│       └─ Game lifecycle         join → choosing → reveal → match_end
│
├─ PostgreSQL                    External backing store for Colyseus driver
│
└─ NestJS routes                 Leaderboard + monitor
```

NestJS initializes first and mounts on the Express app. Colyseus then starts the `BunWebSockets` transport which owns `Bun.serve()` — this is required because Bun's WebSocket API needs the upgrade to happen inside its `fetch` handler.

### Game Flow

```
Waiting → Choosing → Revealing → Choosing → ... → Match End
                                                     │
                                             Play Again? ──→ Choosing
```

- **Authoritative server**: choices are stored in a private `Map` on the server until both players have chosen — clients cannot cheat by reading the opponent's choice early
- **State sync**: Colyseus automatically delta-encodes the room state and sends patches to all connected clients (players and spectators)
- **Reconnection**: if a player disconnects, they have 30 seconds to reconnect before forfeiting

### Client Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Portal.vue` | Combined portal with inline name edit, lobby, and leaderboard |
| `/game` | `Game.vue` | Play the game — all phases rendered reactively |

The client connects directly to the backend (no proxy). Room state changes are observed via `Callbacks.get(room).listen()` from `@colyseus/schema` and mapped to Vue `ref()`s. Available rooms are streamed through Colyseus `LobbyRoom`.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (latest)

### Install

```bash
bun install
```

### Start PostgreSQL

```bash
docker compose up -d postgres
```

The backend expects PostgreSQL at `postgresql://postgres:postgres@127.0.0.1:5432/postgres` by default. Override with `DATABASE_URL` if needed.

For the frontend, set `VITE_SERVER_HOST` to point at the backend host and port when you are not using `localhost`.
Example: `VITE_SERVER_HOST=192.168.1.50:2567`

### Start Full Docker Dev Stack

```bash
docker compose up -d
```

This starts:
- `postgres` on `localhost:5432`
- `server` on `localhost:2567`
- `client` on `localhost:3001`

### Development

Start both server and client:

```bash
bun run dev
```

Or separately:

```bash
bun run dev:server   # http://localhost:2567
bun run dev:client   # http://localhost:3001
```

Then open http://localhost:3001 in two browser tabs to play.

### Colyseus Monitor

The admin dashboard is available at http://localhost:2567/monitor/ when the server is running.

## Testing

### Unit Tests (Server)

Uses `@colyseus/testing` to spin up a test Colyseus server and simulate game rooms with connected clients:

```bash
cd packages/server
bun test
```

Tests cover: full Bo3 match, play again, disconnect forfeit, spectator join, draw rounds.

### E2E Tests (Playwright)

Opens 3 browser contexts (2 players + 1 spectator), plays a full match through the UI:

```bash
# Install browser (first time only)
bunx playwright install chromium --with-deps

# Run tests (starts server + client automatically)
bun run test:e2e
```

### Load Test (Stress Test)

Uses [@colyseus/loadtest](https://docs.colyseus.io/tools/loadtest) to simulate thousands of concurrent games. Clients are paired automatically: even-numbered clients create rooms, odd-numbered clients join them. Each bot plays rounds with random choices until the match ends.

```bash
# Start the server first
bun run dev:server

# Quick smoke test: 50 concurrent games (100 clients)
cd packages/server
bun run loadtest:small

# Full stress test: 10k concurrent games (20k clients)
bun run loadtest
```

The loadtest displays a live TUI dashboard showing connected/disconnected clients, bytes sent/received, and memory/CPU usage. Results are written to a log file.

### Linting

```bash
bun run lint        # Check
bun run lint:fix    # Auto-fix
```

### Type Checking

```bash
bun run typecheck
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leaderboard` | Top players ranked by win rate |
| GET | `/api/leaderboard/:name` | Stats for a specific player |
| GET | `/monitor/` | Colyseus admin dashboard |

## Game Protocol

### Room State (synced automatically)

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | Current game phase |
| `players` | MapSchema | Player data (name, score, hasChosen, connected) |
| `rounds` | ArraySchema | Round history (choices, result) |
| `matchFormat` | number | 3 or 5 (best-of) |
| `currentRound` | number | Current round number |
| `winnerId` | string | Session ID of match winner |
| `spectatorCount` | number | Number of spectators |

### Client Messages

| Type | Payload | When |
|------|---------|------|
| `make_choice` | `{ choice: "rock" \| "paper" \| "scissors" }` | During choosing phase |
| `play_again` | — | After match ends |
| `toggle_ready` | — | Toggle ready state |

## Deployment

The **client** (static Vue app) can deploy to any static host (Vercel, Netlify, etc.).

The **server** requires a platform that supports long-running WebSocket connections:
- [Fly.io](https://fly.io)
- [Railway](https://railway.app)
- [Render](https://render.com)
- [Colyseus Cloud](https://cloud.colyseus.io)

Serverless platforms (Vercel, AWS Lambda) will not work for the backend because Colyseus needs persistent WebSocket connections and in-memory game state.
