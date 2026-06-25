import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getRandomJoke } from "../stores/joke-store.js";

const composer = new Composer<Ctx>();

registerMainMenuItem({ label: "🍿 Random Joke", data: "joke:random", order: 10 });

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

async function sendJoke(ctx: Ctx): Promise<void> {
  const joke = await getRandomJoke();
  if (!joke) {
    await ctx.reply("No jokes available yet — the joke box is empty.");
    return;
  }
  await ctx.reply(joke.text, { reply_markup: backToMenu });
}

composer.command("joke", async (ctx) => {
  await sendJoke(ctx);
});

composer.callbackQuery("joke:random", async (ctx) => {
  await ctx.answerCallbackQuery();
  const joke = await getRandomJoke();
  if (!joke) {
    await ctx.editMessageText("No jokes available yet — the joke box is empty.", { reply_markup: backToMenu });
    return;
  }
  await ctx.editMessageText(joke.text, { reply_markup: backToMenu });
});

export default composer;
