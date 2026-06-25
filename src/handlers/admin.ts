import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, paginate } from "../toolkit/index.js";
import { randomUUID } from "node:crypto";
import { getAllJokes, addJoke, deleteJoke, type Joke } from "../stores/joke-store.js";
import { getRecentLogs } from "../stores/sendlog-store.js";
import { getSchedule, setBroadcastTime } from "../stores/schedule-store.js";
import { subscribedCount } from "../stores/user-store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

function isAdmin(ctx: Ctx): boolean {
  const raw = process.env.ADMIN_USER_ID;
  if (!raw) return false;
  const aid = Number(raw);
  return Number.isFinite(aid) && ctx.from?.id === aid;
}

function requireAdmin(ctx: Ctx): boolean {
  if (!isAdmin(ctx)) {
    ctx.reply("⛔ This action is restricted to the bot owner.").catch(() => {});
    return false;
  }
  return true;
}

const adminMenuKeyboard = inlineKeyboard([
  [inlineButton("⏰ Set Broadcast Time", "admin:settime")],
  [inlineButton("📝 Manage Jokes", "admin:jokes")],
  [inlineButton("📊 View Reports", "admin:reports")],
  [inlineButton("📢 Broadcast Now", "broadcast:trigger")],
  [inlineButton("⬅️ Back to menu", "menu:main")],
]);

const jokesMenuKeyboard = inlineKeyboard([
  [inlineButton("📋 List Jokes", "admin:list_jokes")],
  [inlineButton("➕ Add Joke", "admin:add_joke")],
  [inlineButton("⬅️ Admin Menu", "admin:menu")],
]);

composer.command("admin", async (ctx) => {
  if (!requireAdmin(ctx)) return;
  await ctx.reply("⚙️ Admin Panel", { reply_markup: adminMenuKeyboard });
});

composer.callbackQuery("admin:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!requireAdmin(ctx)) return;
  await ctx.editMessageText("⚙️ Admin Panel", { reply_markup: adminMenuKeyboard });
});

composer.callbackQuery("admin:settime", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!requireAdmin(ctx)) return;
  const schedule = await getSchedule();
  const keyboard = inlineKeyboard([
    [inlineButton("06:00 UTC", "admin:time:06:00"), inlineButton("07:00 UTC", "admin:time:07:00")],
    [inlineButton("08:00 UTC", "admin:time:08:00"), inlineButton("09:00 UTC", "admin:time:09:00")],
    [inlineButton("10:00 UTC", "admin:time:10:00"), inlineButton("12:00 UTC", "admin:time:12:00")],
    [inlineButton("18:00 UTC", "admin:time:18:00"), inlineButton("20:00 UTC", "admin:time:20:00")],
    [inlineButton("⬅️ Admin Menu", "admin:menu")],
  ]);
  await ctx.editMessageText(`Current broadcast time: ${schedule.daily_time_utc} UTC\n\nSelect a new time:`, { reply_markup: keyboard });
});

const timeOptions = ["06:00", "07:00", "08:00", "09:00", "10:00", "12:00", "18:00", "20:00"];
for (const t of timeOptions) {
  composer.callbackQuery(`admin:time:${t}`, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!requireAdmin(ctx)) return;
    await setBroadcastTime(t);
    await ctx.editMessageText(`✅ Broadcast time set to ${t} UTC.`, { reply_markup: adminMenuKeyboard });
  });
}

composer.callbackQuery("admin:jokes", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!requireAdmin(ctx)) return;
  const jokes = await getAllJokes();
  await ctx.editMessageText(`📝 Joke Repository (${jokes.length} jokes)`, { reply_markup: jokesMenuKeyboard });
});

composer.callbackQuery("admin:add_joke", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!requireAdmin(ctx)) return;
  ctx.session.adminStep = "awaiting_joke_text";
  await ctx.editMessageText("Send me the joke text and I'll add it to the repository.", { reply_markup: inlineKeyboard([[inlineButton("⬅️ Cancel", "admin:jokes")]]) });
});

composer.callbackQuery(/^admin:list_jokes(?::page:(\d+))?$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!requireAdmin(ctx)) return;
  const page = ctx.match[1] ? Number(ctx.match[1]) : 0;
  const jokes = await getAllJokes();
  if (jokes.length === 0) {
    await ctx.editMessageText("The joke repository is empty. Tap ➕ Add Joke to add one.", { reply_markup: jokesMenuKeyboard });
    return;
  }
  const paginated = paginate(jokes, { page, perPage: 5, callbackPrefix: "admin:list_jokes" });
  const lines = paginated.pageItems.map((j, i) => {
    const n = paginated.page * 5 + i + 1;
    return `${n}. ${j.text.slice(0, 60)}${j.text.length > 60 ? "…" : ""}`;
  });
  const jokeRows: ReturnType<typeof inlineButton>[][] = paginated.pageItems.map((j) => [
    inlineButton(`🗑️ #${jokes.indexOf(j) + 1}`, `admin:delete_joke:${j.id}`),
  ]);
  const controlRow = paginated.controls.inline_keyboard;
  const bottomRow = [inlineButton("⬅️ Joke Menu", "admin:jokes")];
  const allRows = [...jokeRows, ...controlRow, bottomRow];
  await ctx.editMessageText(`📋 Jokes (page ${paginated.page + 1}/${paginated.totalPages})\n\n${lines.join("\n")}`, { reply_markup: inlineKeyboard(allRows) });
});

composer.callbackQuery(/^admin:delete_joke:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!requireAdmin(ctx)) return;
  const jokeId = ctx.match[1]!;
  await deleteJoke(jokeId);
  // Go back to joke list
  const jokes = await getAllJokes();
  if (jokes.length === 0) {
    await ctx.editMessageText("The joke repository is empty. Tap ➕ Add Joke to add one.", { reply_markup: jokesMenuKeyboard });
    return;
  }
  const paginated = paginate(jokes, { page: 0, perPage: 5, callbackPrefix: "admin:list_jokes" });
  const lines = paginated.pageItems.map((j, i) => `${i + 1}. ${j.text.slice(0, 60)}${j.text.length > 60 ? "…" : ""}`);
  const jokeRows: ReturnType<typeof inlineButton>[][] = paginated.pageItems.map((j) => [
    inlineButton(`🗑️ #${jokes.indexOf(j) + 1}`, `admin:delete_joke:${j.id}`),
  ]);
  const bottomRow = [inlineButton("⬅️ Joke Menu", "admin:jokes")];
  await ctx.editMessageText(`📋 Jokes (page 1/${paginated.totalPages})\n\n${lines.join("\n")}`, { reply_markup: inlineKeyboard([...jokeRows, ...paginated.controls.inline_keyboard, bottomRow]) });
});

composer.on("message:text", async (ctx) => {
  const step = ctx.session.adminStep;
  if (!step) return;

  if (step === "awaiting_joke_text") {
    if (!requireAdmin(ctx)) { ctx.session.adminStep = undefined; return; }
    const text = ctx.message?.text;
    if (!text) {
      ctx.session.adminStep = undefined;
      return;
    }
    const joke: Joke = {
      id: randomUUID(),
      text: text,
      source: "user",
      language: "en",
    };
    await addJoke(joke);
    ctx.session.adminStep = undefined;
    await ctx.reply(`✅ Joke added: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`, { reply_markup: jokesMenuKeyboard });
  }
});

composer.callbackQuery("admin:reports", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!requireAdmin(ctx)) return;
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const logs = await getRecentLogs(since);
  const subCount = await subscribedCount();

  if (logs.length === 0) {
    await ctx.editMessageText(
      `📊 Broadcast Report (last 7 days)\n\nNo broadcasts in the last 7 days.\n\nSubscribed users: ${subCount}`,
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Admin Menu", "admin:menu")]]) },
    );
    return;
  }

  const ok = logs.filter((l) => l.send_result === "ok").length;
  const fail = logs.filter((l) => l.send_result === "error").length;
  const lastBr = logs.reduce((max, l) => Math.max(max, l.timestamp), 0);
  const lastDate = new Date(lastBr).toISOString().slice(0, 10);

  await ctx.editMessageText(
    `📊 Broadcast Report (last 7 days)\n\n` +
    `Last broadcast: ${lastDate}\n` +
    `Total sends: ${logs.length}\n` +
    `Delivered: ${ok}\n` +
    `Failed: ${fail}\n` +
    `Subscribed users: ${subCount}`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Admin Menu", "admin:menu")]]) },
  );
});

export default composer;
