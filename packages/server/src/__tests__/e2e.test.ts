import "reflect-metadata";
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { Server } from "colyseus";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { Client, Room, Callbacks } from "@colyseus/sdk";
import { AppModule } from "../app.module";
import { RPSRoom } from "../colyseus/rooms/rps.room";
import { LeaderboardService } from "../leaderboard/leaderboard.service";
import {
  Choice,
  RoomPhase,
  ClientMessage,
  MatchFormat,
} from "@rps/shared";

const TEST_PORT = 9567;
const WS_URL = `ws://localhost:${TEST_PORT}`;

let gameServer: Server;
let leaderboardService: LeaderboardService;

/** Wait for a room's state to reach a specific phase */
function waitForPhase(room: Room, phase: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const state = room.state;
    if (state.phase === phase) {
      resolve();
      return;
    }
    const timer = setTimeout(
      () => { reject(new Error(`Timed out waiting for phase "${phase}" (stuck on "${state.phase}")`)); },
      timeoutMs,
    );
    const $ = Callbacks.get(room);
    $.listen("phase" as any, (newPhase: string) => {
      if (newPhase === phase) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

/** Play a round: wait for choosing, both players choose, wait for reveal/end */
async function playRound(
  room1: Room,
  room2: Room,
  p1Choice: Choice,
  p2Choice: Choice,
) {
  await waitForPhase(room1, RoomPhase.Choosing);
  room1.send(ClientMessage.MakeChoice, { choice: p1Choice });
  room2.send(ClientMessage.MakeChoice, { choice: p2Choice });
  // Wait for revealing (choices are evaluated)
  await waitForPhase(room1, RoomPhase.Revealing);
}

beforeAll(async () => {
  const nestReady = new Promise<void>((resolve) => {
    gameServer = new Server({
      transport: new BunWebSockets(),
      greet: false,
      express: async (app: express.Application) => {
        const adapter = new ExpressAdapter(app);
        const nestApp = await NestFactory.create(AppModule, adapter, { logger: false });
        leaderboardService = nestApp.get(LeaderboardService);
        RPSRoom.leaderboardService = leaderboardService;
        await nestApp.init();
        resolve();
      },
    });
  });

  gameServer.define("rps", RPSRoom);
  await gameServer.listen(TEST_PORT);
  await nestReady;
});

afterAll(async () => {
  await gameServer.gracefullyShutdown(false);
});

describe("RPS E2E", () => {
  test("two players can complete a Best-of-3 match", async () => {
    const client1 = new Client(WS_URL);
    const client2 = new Client(WS_URL);

    const room1 = await client1.create("rps", {
      name: "Alice",
      matchFormat: MatchFormat.BestOf3,
    });
    expect(room1.sessionId).toBeDefined();

    const room2 = await client2.joinById(room1.roomId, { name: "Bob" });
    expect(room2.sessionId).toBeDefined();
    expect(room2.roomId).toBe(room1.roomId);

    const state1 = room1.state;

    // Round 1: Alice=Rock, Bob=Scissors -> Alice wins
    await playRound(room1, room2, Choice.Rock, Choice.Scissors);

    // Verify round was recorded in state
    expect(state1.currentRound).toBe(1);
    expect(state1.rounds.length).toBe(1);
    const round1 = state1.rounds[0];
    expect(round1.player1Choice).toBe(Choice.Rock);
    expect(round1.player2Choice).toBe(Choice.Scissors);
    expect(round1.result).toBe("player1");

    // Verify scores via player state
    const p1After1 = state1.players.get(state1.player1Id);
    const p2After1 = state1.players.get(state1.player2Id);
    expect(p1After1.score).toBe(1);
    expect(p2After1.score).toBe(0);

    // Round 2: Alice=Paper, Bob=Scissors -> Bob wins
    await playRound(room1, room2, Choice.Paper, Choice.Scissors);

    expect(state1.currentRound).toBe(2);
    const p1After2 = state1.players.get(state1.player1Id);
    const p2After2 = state1.players.get(state1.player2Id);
    expect(p1After2.score).toBe(1);
    expect(p2After2.score).toBe(1);

    // Round 3: Alice=Rock, Bob=Scissors -> Alice wins the match
    await playRound(room1, room2, Choice.Rock, Choice.Scissors);

    await waitForPhase(room1, RoomPhase.MatchEnd);
    expect(state1.winnerId).toBe(room1.sessionId);
    expect(state1.currentRound).toBe(3);

    const p1Final = state1.players.get(state1.player1Id);
    const p2Final = state1.players.get(state1.player2Id);
    expect(p1Final.score).toBe(2);
    expect(p2Final.score).toBe(1);

    // Verify leaderboard
    const aliceStats = leaderboardService.getPlayerStats("Alice");
    expect(aliceStats).not.toBeNull();
    expect(aliceStats!.wins).toBe(1);
    expect(aliceStats!.losses).toBe(0);

    const bobStats = leaderboardService.getPlayerStats("Bob");
    expect(bobStats).not.toBeNull();
    expect(bobStats!.wins).toBe(0);
    expect(bobStats!.losses).toBe(1);

    room1.leave();
    room2.leave();
  }, 60000);

  test("play again resets the match", async () => {
    const client1 = new Client(WS_URL);
    const client2 = new Client(WS_URL);

    const room1 = await client1.create("rps", {
      name: "Charlie",
      matchFormat: MatchFormat.BestOf3,
    });
    const room2 = await client2.joinById(room1.roomId, { name: "Dana" });

    const state1 = room1.state;

    // Win 2 rounds quickly (Rock beats Scissors)
    for (let i = 0; i < 2; i++) {
      await waitForPhase(room1, RoomPhase.Choosing);
      room1.send(ClientMessage.MakeChoice, { choice: Choice.Rock });
      room2.send(ClientMessage.MakeChoice, { choice: Choice.Scissors });
      if (i < 1) {
        await waitForPhase(room1, RoomPhase.RoundEnd);
      }
    }

    await waitForPhase(room1, RoomPhase.MatchEnd);
    expect(state1.winnerId).toBe(room1.sessionId);

    // Both players vote to play again
    room1.send(ClientMessage.PlayAgain);
    room2.send(ClientMessage.PlayAgain);

    await waitForPhase(room1, RoomPhase.Choosing);
    expect(state1.currentRound).toBe(0);
    expect(state1.winnerId).toBe("");

    room1.leave();
    room2.leave();
  }, 60000);

  test("player disconnect mid-match results in forfeit", async () => {
    const client1 = new Client(WS_URL);
    const client2 = new Client(WS_URL);

    const room1 = await client1.create("rps", {
      name: "Eve",
      matchFormat: MatchFormat.BestOf3,
    });
    const room2 = await client2.joinById(room1.roomId, { name: "Frank" });

    const state1 = room1.state;

    await waitForPhase(room1, RoomPhase.Choosing);

    // Player 2 disconnects (consented leave)
    room2.leave(true);

    // Player 1 should win by forfeit
    await waitForPhase(room1, RoomPhase.MatchEnd);
    expect(state1.winnerId).toBe(room1.sessionId);

    room1.leave();
  }, 60000);

  test("spectator can join a full room", async () => {
    const client1 = new Client(WS_URL);
    const client2 = new Client(WS_URL);
    const client3 = new Client(WS_URL);

    const room1 = await client1.create("rps", {
      name: "Gina",
      matchFormat: MatchFormat.BestOf3,
    });
    const room2 = await client2.joinById(room1.roomId, { name: "Hank" });

    const room3 = await client3.joinById(room1.roomId, {
      name: "Spectator",
      spectate: true,
    });
    expect(room3.sessionId).toBeDefined();

    const state3 = room3.state;

    await waitForPhase(room3, RoomPhase.Choosing);
    expect(state3.spectatorCount).toBe(1);
    expect(state3.player1Id).toBeTruthy();
    expect(state3.player2Id).toBeTruthy();

    room1.leave();
    room2.leave();
    room3.leave();
  }, 60000);

  test("leaderboard REST endpoint returns results", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/leaderboard`);
    expect(res.status).toBe(200);

    const entries = await res.json();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);

    const entry = entries[0];
    expect(entry).toHaveProperty("playerName");
    expect(entry).toHaveProperty("wins");
    expect(entry).toHaveProperty("losses");
    expect(entry).toHaveProperty("winRate");
  }, 10000);

  test("draw rounds don't award points", async () => {
    const client1 = new Client(WS_URL);
    const client2 = new Client(WS_URL);

    const room1 = await client1.create("rps", {
      name: "Ivy",
      matchFormat: MatchFormat.BestOf3,
    });
    const room2 = await client2.joinById(room1.roomId, { name: "Jack" });

    const state1 = room1.state;

    // Play a draw round
    await waitForPhase(room1, RoomPhase.Choosing);
    room1.send(ClientMessage.MakeChoice, { choice: Choice.Rock });
    room2.send(ClientMessage.MakeChoice, { choice: Choice.Rock });

    await waitForPhase(room1, RoomPhase.Revealing);

    // Verify round was a draw
    expect(state1.rounds.length).toBe(1);
    expect(state1.rounds[0].result).toBe("draw");

    // Wait for next choosing phase and verify scores are still 0
    await waitForPhase(room1, RoomPhase.Choosing);

    let p1Score = 0;
    let p2Score = 0;
    state1.players.forEach((p: any) => {
      if (p.sessionId === room1.sessionId) p1Score = p.score;
      else p2Score = p.score;
    });
    expect(p1Score).toBe(0);
    expect(p2Score).toBe(0);

    room1.leave();
    room2.leave();
  }, 60000);
});
