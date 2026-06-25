import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { isSubscribed } from "../stores/user-store.js";

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  const fromId = ctx.from?.id;
  const subbed = fromId ? await isSubscribed(fromId) : false;
  const statusLine = subbed
    ? "🔔 You are subscribed to daily jokes at 09:00 UTC."
    : "🔕 You are not subscribed — tap 🔔 Subscribe to get a joke every day.";
  const WELCOME = `👋 Welcome! Tap a button below to get started.\n\n${statusLine}`;
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  const fromId = ctx.from?.id;
  const subbed = fromId ? await isSubscribed(fromId) : false;
  const statusLine = subbed
    ? "🔔 You are subscribed to daily jokes at 09:00 UTC."
    : "🔕 You are not subscribed — tap 🔔 Subscribe to get a joke every day.";
  const WELCOME = `👋 Welcome! Tap a button below to get started.\n\n${statusLine}`;
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
