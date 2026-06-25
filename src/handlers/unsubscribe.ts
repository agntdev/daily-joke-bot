import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getUser, upsertUser } from "../store.js";

registerMainMenuItem({ label: "📴 Unsubscribe", data: "unsubscribe:do", order: 30 });

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

async function doUnsubscribe(ctx: Ctx, edit: boolean) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const existing = await getUser(chatId);
  if (!existing || existing.opt_out_flag) {
    const msg = "You are not currently subscribed.";
    if (edit) await ctx.editMessageText(msg, { reply_markup: backToMenu });
    else await ctx.reply(msg, { reply_markup: backToMenu });
    return;
  }

  await upsertUser({
    telegram_id: chatId,
    display_name: existing.display_name,
    opt_out_flag: true,
  });

  const msg = "❌ You have been unsubscribed from the daily broadcast.";
  if (edit) await ctx.editMessageText(msg, { reply_markup: backToMenu });
  else await ctx.reply(msg, { reply_markup: backToMenu });
}

composer.command("unsubscribe", async (ctx) => {
  await doUnsubscribe(ctx, false);
});

composer.command("stop", async (ctx) => {
  await doUnsubscribe(ctx, false);
});

composer.callbackQuery("unsubscribe:do", async (ctx) => {
  await ctx.answerCallbackQuery();
  await doUnsubscribe(ctx, true);
});

export default composer;
