/**
 * Colyseus loadtest script for Rock Paper Scissors.
 *
 * Simulates concurrent games. Clients are paired: even IDs create rooms,
 * odd IDs join them. Each client plays rounds with random choices until
 * the match ends.
 *
 * Usage:
 *   cd packages/server
 *   bun run loadtest          # 20k clients → 10k concurrent games
 *   bun run loadtest:small    # 100 clients → 50 concurrent games
 */

import { cli, type Options } from "@colyseus/loadtest";
import { Client, Callbacks } from "@colyseus/sdk";
import type { Room } from "@colyseus/sdk";
import { Choice, RoomPhase, ClientMessage, MatchFormat } from "@rps/shared";

const CHOICES = [Choice.Rock, Choice.Paper, Choice.Scissors];

function randomChoice(): Choice {
  return CHOICES[Math.floor(Math.random() * CHOICES.length)];
}

function sleep(ms: number) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// Coordination between paired clients
const pendingRooms = new Map<number, string>();
const pendingResolvers = new Map<number, (roomId: string) => void>();

function publishRoomId(pairId: number, roomId: string) {
  const resolver = pendingResolvers.get(pairId);
  if (resolver) {
    resolver(roomId);
    pendingResolvers.delete(pairId);
  } else {
    pendingRooms.set(pairId, roomId);
  }
}

function waitForRoomId(pairId: number): Promise<string> {
  const existing = pendingRooms.get(pairId);
  if (existing) {
    pendingRooms.delete(pairId);
    return Promise.resolve(existing);
  }
  return new Promise<string>((resolve) => {
    pendingResolvers.set(pairId, resolve);
  });
}

/** Play the game asynchronously (fire-and-forget from cli's perspective) */
async function playGame(room: Room) {
  const $ = Callbacks.get(room);
  const state = room.state as Record<string, unknown>;

  // Wait for choosing phase, make a random choice, repeat until match ends
  let matchOver = false;

  $.listen("phase" as never, (phase: string) => {
    if (phase === RoomPhase.MatchEnd) {
      matchOver = true;
    }

    if (phase === RoomPhase.Choosing && !matchOver) {
      // Small random delay then choose
      void sleep(10 + Math.random() * 50).then(() => {
        if (!matchOver && (state.phase as string) === RoomPhase.Choosing) {
          room.send(ClientMessage.MakeChoice, { choice: randomChoice() });
        }
      });
    }
  });

  // If already in choosing phase (joined second), trigger immediately
  if (state.phase === RoomPhase.Choosing) {
    await sleep(10 + Math.random() * 50);
    if (!matchOver) {
      room.send(ClientMessage.MakeChoice, { choice: randomChoice() });
    }
  }
}

cli(async (options: Options) => {
  const wsEndpoint = options.endpoint.replace(/^http/, "ws");
  const client = new Client(wsEndpoint);
  const pairId = Math.floor(options.clientId / 2);
  const isCreator = options.clientId % 2 === 0;

  let room: Room;

  if (isCreator) {
    room = await client.create(options.roomName, {
      name: `Bot-${options.clientId}`,
      matchFormat: MatchFormat.BestOf3,
    });
    publishRoomId(pairId, room.roomId);
  } else {
    const roomId = await waitForRoomId(pairId);
    room = await client.joinById(roomId, {
      name: `Bot-${options.clientId}`,
    });
  }

  // Start playing asynchronously — don't await, so cli() can spawn the next client
  void playGame(room);
});
