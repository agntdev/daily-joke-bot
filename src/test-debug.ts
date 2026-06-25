import { buildBot } from "./bot.js";

async function main() {
  try {
    const bot = await buildBot("test-token");
    console.log("Bot built successfully");
    (bot as any).botInfo = { id: 42, is_bot: true, first_name: "TestBot", username: "test_bot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false };
    const result = await bot.api.sendMessage(1, "test");
    console.log("sendMessage result:", JSON.stringify(result));
  } catch(e) {
    console.error("Error:", e);
  }
}
main();
