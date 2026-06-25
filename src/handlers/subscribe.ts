import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { isSubscribed, subscribe, unsubscribe } from "../stores/user-store.js";

const composer = new Composer<Ctx>();

registerMainMenuItem({ label: "🔔 Subscribe", data: "subscribe:do", order: 20 });
registerMainMenuItem({ label: "🔕 Unsubscribe", data: "unsubscribe:do", order: 30 });

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("subscribe", async (ctx) => {
  const fromId = ctx.from?.id;
  if (!fromId) return;
  const alreadySub = await isSubscribed(fromId);
  await subscribe(fromId, ctx.from?.first_name ?? "User");
  if (alreadySub) {
    await ctx.reply("🔔 You're already subscribed to daily jokes!");
  } else {
    await ctx.reply("🔔 You're now subscribed to daily jokes! You'll receive a joke every day at 09:00 UTC.");
  }
});

composer.command("unsubscribe", async (ctx) => {
  const fromId = ctx.from?.id;
  if (!fromId) return;
  const wasSub = await isSubscribed(fromId);
  await unsubscribe(fromId);
  if (wasSub) {
    await ctx.reply("🔕 You've been unsubscribed from daily jokes. Tap Subscribe anytime to rejoin.");
  } else {
    await ctx.reply("🔕 You're not currently subscribed to daily jokes.");
  }
});

composer.command("stop", async (ctx) => {
  const fromId = ctx.from?.id;
  if (!fromId) return;
  const wasSub = await isSubscribed(fromId);
  await unsubscribe(fromId);
  if (wasSub) {
    await ctx.reply("🔕 You've been unsubscribed from daily jokes. Tap Subscribe anytime to rejoin.");
  } else {
    await ctx.reply("🔕 You're not currently subscribed to daily jokes.");
  }
});

composer.callbackQuery("subscribe:do", async (ctx) => {
  await ctx.answerCallbackQuery();
  const fromId = ctx.from?.id;
  if (!fromId) return;
  const alreadySub = await isSubscribed(fromId);
  await subscribe(fromId, ctx.from?.first_name ?? "User");
  if (alreadySub) {
    await ctx.editMessageText("🔔 You're already subscribed to daily jokes!", { reply_markup: backToMenu });
  } else {
    await ctx.editMessageText("🔔 You're now subscribed to daily jokes! You'll receive a joke every day at 09:00 UTC.", { reply_markup: backToMenu });
  }
});

composer.callbackQuery("unsubscribe:do", async (ctx) => {
  await ctx.answerCallbackQuery();
  const fromId = ctx.from?.id;
  if (!fromId) return;
  const wasSub = await isSubscribed(fromId);
  await unsubscribe(fromId);
  if (wasSub) {
    await ctx.editMessageText("🔕 You've been unsubscribed from daily jokes. Tap Subscribe anytime to rejoin.", { reply_markup: backToMenu });
  } else {
    await ctx.editMessageText("🔕 You're not currently subscribed to daily jokes.", { reply_markup: backToMenu });
  }
});

export default composer;
