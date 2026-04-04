import {
  RandomJoiner,
  RandomCreator,
} from "./index";

const SERVER_URL = process.env.SERVER_URL ?? "server:2567";
const NUM_CREATORS = parseInt(process.env.NUM_CREATORS ?? "2", 10);
const NUM_JOINERS = parseInt(process.env.NUM_JOINERS ?? "10", 10);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spawnBots() {
  const total = NUM_CREATORS + NUM_JOINERS;
  console.log(`Spawning ${total} bots (${NUM_CREATORS} creators, ${NUM_JOINERS} joiners) connecting to ${SERVER_URL}`);

  const bots: { Class: typeof RandomCreator | typeof RandomJoiner; name: string }[] = [
    ...Array.from({ length: NUM_CREATORS }, (_, i) => ({ Class: RandomCreator, name: `RandomCreator_${i}` })),
    ...Array.from({ length: NUM_JOINERS }, (_, i) => ({ Class: RandomJoiner, name: `RandomJoiner_${i}` })),
  ];

  for (const { Class, name } of bots) {
    const bot = new Class(name, SERVER_URL);

    void bot.run().catch((err: unknown) => {
      console.error(`Bot ${name} error:`, err);
    });

    await sleep(500);
  }

  console.log(`Spawned ${total} bots`);
}

void spawnBots();
