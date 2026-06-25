import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getRandomJoke, getUser, upsertUser } from "../store.js";

registerMainMenuItem({ label: "😂 Random Joke", data: "joke:random", order: 10 });

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

async function sendRandomJoke(ctx: Ctx, edit: boolean) {
  const joke = await getRandomJoke();
  if (!joke) {
    if (edit) {
      await ctx.editMessageText("The joke repository is empty. Please check back later.", { reply_markup: backToMenu });
    } else {
      await ctx.reply("The joke repository is empty. Please check back later.", { reply_markup: backToMenu });
    }
    return;
  }

  // Track user in the store
  const chatId = ctx.chat?.id;
  if (chatId) {
    const existing = await getUser(chatId);
    if (!existing) {
      await upsertUser({
        telegram_id: chatId,
        display_name: ctx.from?.first_name ?? "User",
        opt_out_flag: false,
      });
    }
  }

  if (edit) {
    await ctx.editMessageText(joke.text, { reply_markup: backToMenu });
  } else {
    await ctx.reply(joke.text, { reply_markup: backToMenu });
  }
}

composer.command("joke", async (ctx) => {
  await sendRandomJoke(ctx, false);
});

composer.callbackQuery("joke:random", async (ctx) => {
  await ctx.answerCallbackQuery();
  await sendRandomJoke(ctx, true);
});

export default composer;
