import "reflect-metadata";
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Server } from "colyseus";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { ColyseusTestServer } from "@colyseus/testing";
import { RPSRoom } from "../colyseus/rooms/rps.room";
import { LeaderboardService } from "../leaderboard/leaderboard.service";
import {
  Choice,
  RoomPhase,
  ClientMessage,
  MatchFormat,
} from "@rps/shared";
import type { Room } from "colyseus";

let colyseus: ColyseusTestServer;
let leaderboardService: LeaderboardService;

function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function getTestPort() {
  return 30_000 + Math.floor(Math.random() * 20_000);
}

async function startServerWithRetry(server: Server, attempts = 25) {
  for (let i = 0; i < attempts; i++) {
    const port = getTestPort();
    try {
      await server.listen(port);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EADDRINUSE" || i === attempts - 1) {
        throw error;
      }
    }
  }
}

beforeAll(async () => {
  leaderboardService = new LeaderboardService();
  RPSRoom.leaderboardService = leaderboardService;

  const server = new Server({ transport: new BunWebSockets(), greet: false });
  server.define("rps", RPSRoom);

  await startServerWithRetry(server);
  colyseus = new ColyseusTestServer(server);
});

afterAll(async () => {
  await colyseus.shutdown();
});

beforeEach(async () => {
  await colyseus.cleanup();
});

/** Wait until server room state reaches a given phase */
async function waitForPhase(room: Room<{ state: { phase: string } }>, phase: string, timeoutMs = 15000) {
  const start = Date.now();
  while (room.state.phase !== phase) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for phase "${phase}" (stuck on "${room.state.phase}")`);
    }
    await new Promise((r) => { setTimeout(r, 50); });
  }
}

describe("RPS", () => {
  test("two players can complete a Best-of-3 match", async () => {
    const room = await colyseus.createRoom<RPSRoom>("rps", {
      matchFormat: MatchFormat.BestOf3,
    });

    const client1 = await colyseus.connectTo(room, { name: "Alice" });
    const client2 = await colyseus.connectTo(room, { name: "Bob" });

    await waitForPhase(room, RoomPhase.Choosing);

    // Round 1: Alice=Rock, Bob=Scissors → Alice wins
    client1.send(ClientMessage.MakeChoice, { choice: Choice.Rock });
    client2.send(ClientMessage.MakeChoice, { choice: Choice.Scissors });
    await waitForPhase(room, RoomPhase.Revealing);

    expect(room.state.currentRound).toBe(1);
    expect(room.state.rounds[0].result).toBe("player1");
    const round1Player1 = assertDefined(room.state.players.get(room.state.player1Id), "player1 should exist");
    const round1Player2 = assertDefined(room.state.players.get(room.state.player2Id), "player2 should exist");
    expect(round1Player1.score).toBe(1);
    expect(round1Player2.score).toBe(0);

    // Round 2: Alice=Paper, Bob=Scissors → Bob wins
    await waitForPhase(room, RoomPhase.Choosing);
    client1.send(ClientMessage.MakeChoice, { choice: Choice.Paper });
    client2.send(ClientMessage.MakeChoice, { choice: Choice.Scissors });
    await waitForPhase(room, RoomPhase.Revealing);

    expect(room.state.currentRound).toBe(2);
    expect(room.state.rounds[1].result).toBe("player2");

    // Round 3: Alice=Rock, Bob=Scissors → Alice wins the match
    await waitForPhase(room, RoomPhase.Choosing);
    client1.send(ClientMessage.MakeChoice, { choice: Choice.Rock });
    client2.send(ClientMessage.MakeChoice, { choice: Choice.Scissors });
    await waitForPhase(room, RoomPhase.MatchEnd);

    expect(room.state.winnerId).toBe(client1.sessionId);
    const finalPlayer1 = assertDefined(room.state.players.get(room.state.player1Id), "player1 should exist");
    const finalPlayer2 = assertDefined(room.state.players.get(room.state.player2Id), "player2 should exist");
    expect(finalPlayer1.score).toBe(2);
    expect(finalPlayer2.score).toBe(1);

    // Verify leaderboard
    const aliceStats = leaderboardService.getPlayerStats("Alice");
    const alice = assertDefined(aliceStats, "alice stats should exist");
    expect(alice.wins).toBeGreaterThanOrEqual(1);

    const bobStats = leaderboardService.getPlayerStats("Bob");
    const bob = assertDefined(bobStats, "bob stats should exist");
    expect(bob.losses).toBeGreaterThanOrEqual(1);
  }, 30000);

  test("match remains ended after result", async () => {
    const room = await colyseus.createRoom<RPSRoom>("rps", {
      matchFormat: MatchFormat.BestOf3,
    });

    const client1 = await colyseus.connectTo(room, { name: "Charlie" });
    const client2 = await colyseus.connectTo(room, { name: "Dana" });

    // Win 2 rounds (Rock beats Scissors)
    for (let i = 0; i < 2; i++) {
      await waitForPhase(room, RoomPhase.Choosing);
      client1.send(ClientMessage.MakeChoice, { choice: Choice.Rock });
      client2.send(ClientMessage.MakeChoice, { choice: Choice.Scissors });
      if (i < 1) {
        await waitForPhase(room, RoomPhase.Revealing);
        await waitForPhase(room, RoomPhase.Choosing);
      }
    }

    await waitForPhase(room, RoomPhase.MatchEnd);
    expect(room.state.winnerId).toBe(client1.sessionId);

    // Replay is disabled; room should remain in MatchEnd.
    await new Promise((resolve) => { setTimeout(resolve, 500); });
    expect(room.state.phase).toBe(RoomPhase.MatchEnd);
  }, 30000);

  test("player disconnect mid-match results in forfeit", async () => {
    const room = await colyseus.createRoom<RPSRoom>("rps", {
      matchFormat: MatchFormat.BestOf3,
    });

    const client1 = await colyseus.connectTo(room, { name: "Eve" });
    const client2 = await colyseus.connectTo(room, { name: "Frank" });

    await waitForPhase(room, RoomPhase.Choosing);

    await client2.leave(true);

    await waitForPhase(room, RoomPhase.MatchEnd);
    expect(room.state.winnerId).toBe(client1.sessionId);
  }, 30000);

  test("room auto-closes after match ends", async () => {
    const room = await colyseus.createRoom<RPSRoom>("rps", {
      matchFormat: MatchFormat.BestOf3,
    });

    const client1 = await colyseus.connectTo(room, { name: "Lisa" });
    const client2 = await colyseus.connectTo(room, { name: "Mike" });

    await waitForPhase(room, RoomPhase.Choosing);

    for (let i = 0; i < 2; i++) {
      client1.send(ClientMessage.MakeChoice, { choice: Choice.Rock });
      client2.send(ClientMessage.MakeChoice, { choice: Choice.Scissors });
      if (i < 1) {
        await waitForPhase(room, RoomPhase.Revealing);
        await waitForPhase(room, RoomPhase.Choosing);
      }
    }

    await waitForPhase(room, RoomPhase.MatchEnd);

    const disconnected = new Promise<boolean>((resolve) => {
      client1.onLeave(() => { resolve(true); });
      setTimeout(() => { resolve(false); }, 12_000);
    });

    const result = await disconnected;
    expect(result).toBe(true);
  }, 30_000);

  test("spectator can join a full room", async () => {
    const room = await colyseus.createRoom<RPSRoom>("rps", {
      matchFormat: MatchFormat.BestOf3,
    });

    const _client1 = await colyseus.connectTo(room, { name: "Gina" });
    const _client2 = await colyseus.connectTo(room, { name: "Hank" });
    const spectator = await colyseus.connectTo(room, { name: "Spectator", spectate: true });

    await waitForPhase(room, RoomPhase.Choosing);

    expect(room.state.spectatorCount).toBe(1);
    expect(room.state.player1Id).toBeTruthy();
    expect(room.state.player2Id).toBeTruthy();
    expect(room.state.players.has(spectator.sessionId)).toBe(false);
  }, 30000);

  test("draw rounds don't award points", async () => {
    const room = await colyseus.createRoom<RPSRoom>("rps", {
      matchFormat: MatchFormat.BestOf3,
    });

    const client1 = await colyseus.connectTo(room, { name: "Ivy" });
    const client2 = await colyseus.connectTo(room, { name: "Jack" });

    await waitForPhase(room, RoomPhase.Choosing);

    client1.send(ClientMessage.MakeChoice, { choice: Choice.Rock });
    client2.send(ClientMessage.MakeChoice, { choice: Choice.Rock });
    await waitForPhase(room, RoomPhase.Revealing);

    expect(room.state.rounds[0].result).toBe("draw");
    const drawPlayer1 = assertDefined(room.state.players.get(room.state.player1Id), "player1 should exist");
    const drawPlayer2 = assertDefined(room.state.players.get(room.state.player2Id), "player2 should exist");
    expect(drawPlayer1.score).toBe(0);
    expect(drawPlayer2.score).toBe(0);
  }, 30000);
});
