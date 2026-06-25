import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { getUser } from "../store.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const WELCOME = "👋 Welcome! Tap a button below to get started.";

async function statusLine(ctx: Ctx): Promise<string> {
  const chatId = ctx.chat?.id;
  if (!chatId) return "";
  const user = await getUser(chatId);
  if (!user) return "\n\nYou are not subscribed to the daily broadcast.";
  if (user.opt_out_flag) return "\n\n❌ Unsubscribed from daily broadcast.";
  return "\n\n✅ Subscribed to daily broadcast at 09:00 UTC.";
}

composer.command("start", async (ctx) => {
  const msg = WELCOME + await statusLine(ctx);
  await ctx.reply(msg, { reply_markup: mainMenuKeyboard() });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  const msg = WELCOME + await statusLine(ctx);
  await ctx.editMessageText(msg, { reply_markup: mainMenuKeyboard() });
});

export default composer;
