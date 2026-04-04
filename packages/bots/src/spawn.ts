import {
  RandomJoiner,
  RandomCreator,
} from "./index";

const SERVER_URL = process.env.SERVER_URL ?? "server:2567";
const NUM_BOTS = parseInt(process.env.NUM_BOTS ?? "10", 10);

const botClasses = [
  { Class: RandomJoiner, name: "RandomJoiner" },
  { Class: RandomCreator, name: "RandomCreator" },
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spawnBots() {
  console.log(`Spawning ${NUM_BOTS} bots connecting to ${SERVER_URL}`);

  const bots: { run: () => Promise<void> }[] = [];

  for (let i = 0; i < NUM_BOTS; i++) {
    const { Class, name } = botClasses[i % botClasses.length];
    const bot = new Class(`${name}_${i}`, SERVER_URL);
    bots.push(bot);

    void bot.run().catch((err: unknown) => {
      console.error(`Bot ${name}_${i} error:`, err);
    });

    await sleep(500);
  }

  console.log(`Spawned ${NUM_BOTS} bots`);
}

void spawnBots();
