# Agent Guidelines for Rock-Paper-Scissors

This document provides guidance for AI agents working on this Rock-Paper-Scissors multiplayer game codebase.

## Project Overview

This is a full-stack multiplayer RPS game with:
- **Server**: NestJS + Colyseus (WebSocket) backend with PostgreSQL
- **Client**: Vue 3 + Vite frontend
- **Shared**: Common types/constants package (`@rps/shared`)
- **E2E**: Playwright tests
- **Tests**: Bun test unit tests

## Build/Lint/Test Commands

### Development
```bash
# Start both server and client in dev mode
bun run dev

# Start only server (port 2567)
bun run dev:server

# Start only client (port 3001)
bun run dev:client
```

### Building
```bash
# Build all packages
bun run build

# Build server only
bun run --filter server build

# Build client only
bun run --filter client build
```

### Linting & Type Checking
```bash
# Lint all packages (ESLint + TypeScript strict rules)
bun run lint

# Auto-fix linting issues
bun run lint:fix

# Type check all packages
bun run typecheck
```

### Testing

#### Unit Tests (Bun)
```bash
# Run all unit tests
bun test packages/server/src/__tests__

# Run a single test file
bun test packages/server/src/__tests__/e2e.test.ts

# Run a single test (using --test-name-pattern)
bun test packages/server/src/__tests__/e2e.test.ts --test-name-pattern "two players can complete"
```

#### E2E Tests (Playwright)
```bash
# Requires: server running on :2567, client on :3001
bun run test:e2e

# Run specific e2e test
npx playwright test e2e/match.spec.ts

# Run with UI
npx playwright test e2e/match.spec.ts --ui

# Run specific test
npx playwright test e2e/match.spec.ts --grep "spectator"
```

#### Pre-commit Hook
Runs automatically before commits (also run manually):
```bash
bun run precommit  # lint + unit tests + e2e tests
```

## Code Style Guidelines

### General
- **Language**: TypeScript (strict mode enabled)
- **Package manager**: Bun
- **Module system**: ESNext with bundler resolution
- **Decorator syntax**: Enable experimental decorators for Colyseus/NestJS

### TypeScript Configuration
From `tsconfig.base.json`:
```json
{
  "strict": true,
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "bundler",
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

### ESLint Rules (Strict Mode)
The codebase enforces strict TypeScript linting:

**Required patterns:**
- No `any` types - use `unknown` or proper generics
- No floating promises - always await or void
- No unused variables (prefix with `_` if intentional)
- No unsafe argument/assignment/call/member-access/return
- No unnecessary conditions
- Strict boolean expressions
- No explicit `any`: `@typescript-eslint/no-explicit-any: "error"`
- No extrinsic classes (unless with decorator)

**Import pattern:**
```typescript
import { type Foo, foo } from "bar";
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `rps.room.ts`, `my-component.vue` |
| Classes | PascalCase | `RPSRoom`, `PlayerSchema` |
| Interfaces | PascalCase with `Schema` suffix for Colyseus | `RPSRoomState`, `PlayerSchema` |
| Types | PascalCase | `RoomPhase`, `Choice` |
| Enums | PascalCase members | `RoomPhase.Choosing` |
| Constants | SCREAMING_SNAKE_CASE | `REVEAL_DURATION_MS` |
| Variables | camelCase | `playerSlots`, `matchFormat` |
| Vue Components | PascalCase files, multi-word names | `Game.vue` with `defineOptions({ name: "GamePage" })` |

### Vue Component Guidelines

**Script setup syntax:**
```typescript
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

defineOptions({ name: "ComponentName" });

// Type interfaces for component state
interface PlayerView {
  name: string;
  score: number;
}
</script>
```

**Template patterns:**
- Use `data-testid` attributes for all interactive elements (required for E2E tests)
- Use kebab-case for all HTML attributes and Vue directives
- Prefer `v-if` over `v-show` for conditional rendering
- Always provide keys for `v-for` loops

### Colyseus Room Patterns

**Room class structure:**
```typescript
export class RPSRoom extends Room<RPSRoomOptions> {
  // Static service injection (avoid DI container in tests)
  static leaderboardService: LeaderboardService | undefined;

  // Private state maps
  private pendingChoices = new Map<string, Choice>();
  private playerSlots: string[] = [];

  // Message handlers
  messages = {
    [ClientMessage.MakeChoice]: (client, payload) => {
      this.handleMakeChoice(client, payload);
    },
  };

  onCreate(options) { /* ... */ }
  onJoin(client, options) { /* ... */ }
  onLeave(client, code) { /* ... */ }
}
```

**Schema patterns (Colyseus):**
```typescript
export class PlayerSchema extends Schema {
  @type("string") sessionId = "";
  @type("number") score = 0;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}
```

### Error Handling

**Prefer explicit type guards:**
```typescript
function isChoice(value: string): value is Choice {
  return value === "rock" || value === "paper" || value === "scissors";
}
```

**Use assertion functions for tests:**
```typescript
function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}
```

**Always void top-level promises:**
```typescript
void bootstrap();  // in main.ts
void router.push("/");  // in Vue components
```

### Testing Patterns

**Bun test structure:**
```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";

describe("RPS", () => {
  test("description", async () => {
    // Arrange
    const room = await colyseus.createRoom<RPSRoom>("rps", options);
    
    // Act
    client.send(ClientMessage.MakeChoice, { choice: Choice.Rock });
    
    // Assert
    expect(room.state.phase).toBe(RoomPhase.Choosing);
  }, 30000);  // Timeout in ms
});
```

**E2E test patterns:**
```typescript
async function waitForPhase(page: Page, phase: string) {
  await page.getByTestId(`phase-${phase}`).waitFor({ timeout: 20_000 });
}

async function choose(page: Page, choice: "rock" | "paper" | "scissors") {
  await page.getByTestId(`choice-${choice}`).click();
}
```

### Import Organization

**Order:**
1. Node/reflect-metadata imports
2. External packages (colyseus, @nestjs, vue, etc.)
3. Internal packages (@rps/shared)
4. Relative imports (../../, ../)
5. Type imports (use `import type` when only using types)

### Pre-commit Checks

The pre-commit hook runs:
1. `bun run lint` - ESLint check
2. `bun run test` - Unit tests
3. `bun run test:e2e` - Playwright E2E tests

All must pass for commits to complete.

## Architecture Notes

### State Synchronization
- Server uses Colyseus schema for state sync
- Client listens via `$.listen()` and `$.onAdd()`/`$.onRemove()`
- Use `defineOptions({ name: "..." })` for Vue component names (enforced by `vue/multi-word-component-names`)

### Database
- PostgreSQL via `@colyseus/drizzle-driver`
- Leaderboard service manages player stats
- Connection: `DATABASE_URL` env var (default: `postgresql://postgres:postgres@127.0.0.1:5432/postgres`)

### Environment Variables
- `PORT`: Server port (default: 2567)
- `DATABASE_URL`: PostgreSQL connection string
- `VITE_SERVER_HOST`: Client's server host (default: localhost:2567)
