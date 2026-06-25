import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getUser, upsertUser } from "../store.js";

registerMainMenuItem({ label: "📬 Subscribe", data: "subscribe:do", order: 20 });

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

async function doSubscribe(ctx: Ctx, edit: boolean) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const existing = await getUser(chatId);
  if (existing && !existing.opt_out_flag) {
    const msg = "You are already subscribed to the daily broadcast.";
    if (edit) await ctx.editMessageText(msg, { reply_markup: backToMenu });
    else await ctx.reply(msg, { reply_markup: backToMenu });
    return;
  }

  await upsertUser({
    telegram_id: chatId,
    display_name: existing?.display_name ?? ctx.from?.first_name ?? "User",
    opt_out_flag: false,
  });

  const msg = "✅ You are now subscribed! You'll receive a daily joke at 09:00 UTC.";
  if (edit) await ctx.editMessageText(msg, { reply_markup: backToMenu });
  else await ctx.reply(msg, { reply_markup: backToMenu });
}

composer.command("subscribe", async (ctx) => {
  await doSubscribe(ctx, false);
});

composer.callbackQuery("subscribe:do", async (ctx) => {
  await ctx.answerCallbackQuery();
  await doSubscribe(ctx, true);
});

export default composer;
