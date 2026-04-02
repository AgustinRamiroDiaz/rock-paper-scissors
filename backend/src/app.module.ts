import { Module } from "@nestjs/common";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";

@Module({
  imports: [LeaderboardModule],
})
export class AppModule {}
