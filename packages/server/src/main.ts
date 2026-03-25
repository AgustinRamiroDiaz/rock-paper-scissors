import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "./app.module";
import { Server, defineRoom } from "colyseus";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { RPSRoom } from "./colyseus/rooms/rps.room";
import { LeaderboardService } from "./leaderboard/leaderboard.service";

async function bootstrap() {
  const port = parseInt(process.env.PORT ?? "2567", 10);

  // Create Colyseus server - it owns the HTTP server and listen lifecycle
  const gameServer = new Server({
    transport: new BunWebSockets(),
    express: (colyseusApp) => {
      // NestJS will mount its routes onto the same Express app
      nestSetup(colyseusApp);
    },
  });

  gameServer.define("rps", RPSRoom);
  await gameServer.listen(port);

  console.log(`Server running on http://localhost:${port}`);
  console.log(`Colyseus rooms registered: rps`);
}

async function nestSetup(expressApp: express.Application) {
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);
  app.enableCors();

  // Inject leaderboard service into Colyseus rooms
  const leaderboardService = app.get(LeaderboardService);
  RPSRoom.leaderboardService = leaderboardService;

  await app.init();
}

bootstrap();
