import { buildBot } from "./bot.js";
import { setDefaultCommands } from "./toolkit/index.js";
import { startBroadcastScheduler } from "./handlers/broadcast.js";

async function main() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN is required");
    process.exit(1);
  }
  const bot = await buildBot(token);
  await setDefaultCommands(bot, [
    { command: "joke", description: "Get a random joke" },
    { command: "subscribe", description: "Subscribe to daily jokes" },
    { command: "unsubscribe", description: "Unsubscribe from daily jokes" },
    { command: "stop", description: "Unsubscribe from daily jokes" },
    { command: "admin", description: "Admin controls (owner only)" },
  ]);
  startBroadcastScheduler(bot);
  bot.start();
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
