import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { matchMaker, monitor, Server } from "colyseus";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { RPSRoom } from "./colyseus/rooms/rps.room";
import { LeaderboardService } from "./leaderboard/leaderboard.service";

async function bootstrap() {
  const port = parseInt(process.env.PORT ?? "2567", 10);

  // BunWebSockets must own `Bun.serve()` for WebSocket upgrades,
  // so we extract its Express app and mount NestJS on it.
  const transport = new BunWebSockets();
  const expressApp = transport.getExpressApp();

  // Initialize NestJS on the shared Express instance
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  app.enableCors();
  app.use("/monitor", monitor());

  // Room listing (Colyseus 0.17 doesn't expose this by default)
  expressApp.get("/matchmake/:roomName", async (req, res) => {
    try {
      const rooms = await matchMaker.query({ name: req.params.roomName, private: false, locked: false });
      res.json(rooms);
    } catch {
      res.json([]);
    }
  });

  // Make NestJS services available to Colyseus rooms
  RPSRoom.leaderboardService = app.get(LeaderboardService);

  await app.init();

  // Start Colyseus with the transport (handles WebSocket + HTTP listening)
  const gameServer = new Server({ transport, greet: false });
  gameServer.define("rps", RPSRoom);
  await gameServer.listen(port);

  console.log(`Server running on http://localhost:${port}`);
}

void bootstrap();
