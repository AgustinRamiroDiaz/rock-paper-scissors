import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { PostgresDriver } from "@colyseus/drizzle-driver";
import { AppModule } from "./app.module";
import { monitor, Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import { RPSLobbyRoom } from "./colyseus/rooms/rps-lobby.room";
import { RPSRoom } from "./colyseus/rooms/rps.room";
import { LeaderboardService } from "./leaderboard/leaderboard.service";

async function bootstrap() {
  const port = parseInt(process.env.PORT ?? "2567", 10);
  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  const expressApp = express();
  const httpServer = createServer(expressApp);

  // Initialize NestJS on Express
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  app.enableCors();
  app.use("/monitor", monitor());

  // Make NestJS services available to Colyseus rooms
  RPSRoom.leaderboardService = app.get(LeaderboardService);

  await app.init();

  // Start Colyseus with the HTTP server
  const gameServer = new Server({
    server: httpServer,
    greet: false,
    driver: new PostgresDriver(),
  });
  gameServer.define("lobby", RPSLobbyRoom);
  gameServer.define("rps", RPSRoom).enableRealtimeListing();
  await gameServer.listen(port);

  console.log(`Server running on http://localhost:${port} (PostgreSQL: ${databaseUrl})`);
}

void bootstrap();