import { randomUUID } from "node:crypto";
import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard, paginate } from "../toolkit/index.js";
import { getRandomJoke, getAllSubscribedUsers, addSendLog, getRecentSendLogs, getSchedule, setSchedule, addJoke, getLastBroadcastDate, setLastBroadcastDate, getAllJokes, removeJoke } from "../store.js";

registerMainMenuItem({ label: "🕐 Set Time", data: "admin:settime", order: 90 });
registerMainMenuItem({ label: "➕ Add Joke", data: "admin:addjoke", order: 91 });
registerMainMenuItem({ label: "📊 Report", data: "admin:report", order: 92 });
registerMainMenuItem({ label: "📋 List Jokes", data: "admin:listjokes", order: 93 });
registerMainMenuItem({ label: "🗑 Remove Joke", data: "admin:removejoke", order: 94 });

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

function adminId(): number | undefined {
  const raw = process.env.ADMIN_TELEGRAM_ID;
  if (!raw) return undefined;
  return Number(raw);
}

function isAdmin(ctx: Ctx): boolean {
  const id = adminId();
  if (id === undefined) return false;
  return ctx.chat?.id === id;
}

// ── Admin check gate ──
async function gate(ctx: Ctx): Promise<boolean> {
  if (!isAdmin(ctx)) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("This feature is for the bot owner only.", { reply_markup: backToMenu });
    return false;
  }
  await ctx.answerCallbackQuery();
  return true;
}

// ── Set broadcast time ──
composer.callbackQuery("admin:settime", async (ctx) => {
  if (!(await gate(ctx))) return;
  const schedule = await getSchedule();
  const msg = `🕐 Current broadcast time: ${schedule.daily_time_utc} UTC.\n\nUse /settime HH:MM to change it (24-hour format).`;
  await ctx.editMessageText(msg, { reply_markup: backToMenu });
});

composer.hears(/^\/settime\s+(\d{2}:\d{2})$/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("This feature is for the bot owner only.");
    return;
  }
  const time = ctx.match[1];
  await setSchedule({ daily_time_utc: time });
  await ctx.reply(`✅ Broadcast time set to ${time} UTC.`);
});

// ── Add joke flow (multi-step via session) ──
composer.callbackQuery("admin:addjoke", async (ctx) => {
  if (!(await gate(ctx))) return;
  ctx.session.step = "awaiting_joke_text";
  await ctx.editMessageText("Send me the joke text you want to add:", { reply_markup: backToMenu });
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx)) return next();
  const text = ctx.message.text;
  if (text.startsWith("/")) return next();

  if (ctx.session.step === "awaiting_joke_text") {
    const id = randomUUID();
    await addJoke({ id, text, source: "manual", language: "en" });
    ctx.session.step = undefined;
    await ctx.reply("✅ Joke added!", { reply_markup: backToMenu });
    return;
  }

  if (ctx.session.step === "awaiting_joke_id") {
    ctx.session.step = undefined;
    const removed = await removeJoke(text.trim());
    if (removed) {
      await ctx.reply(`✅ Joke #${text.trim()} removed.`, { reply_markup: backToMenu });
    } else {
      await ctx.reply(`Joke #${text.trim()} not found.`, { reply_markup: backToMenu });
    }
    return;
  }

  return next();
});

// ── List jokes ──
const JOKES_PER_PAGE = 5;

async function showJokePage(ctx: Ctx, page: number) {
  const jokes = await getAllJokes();
  if (jokes.length === 0) {
    await ctx.editMessageText("No jokes in the repository yet. Use ➕ Add Joke to add one.", { reply_markup: backToMenu });
    return;
  }
  const p = paginate(jokes, { page, perPage: JOKES_PER_PAGE, callbackPrefix: "jokepage" });
  const lines = p.pageItems.map(j => `#${j.id}: ${j.text}`);
  const header = `📋 Jokes (page ${p.page + 1}/${p.totalPages}, ${jokes.length} total):`;
  const msg = `${header}\n\n${lines.join("\n\n")}`;
  const keyboard = inlineKeyboard([
    ...p.controls.inline_keyboard,
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);
  await ctx.editMessageText(msg, { reply_markup: keyboard });
}

composer.callbackQuery("admin:listjokes", async (ctx) => {
  if (!(await gate(ctx))) return;
  await showJokePage(ctx, 0);
});

composer.callbackQuery(/^jokepage:(prev|next):(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCallbackQuery();
    return;
  }
  await ctx.answerCallbackQuery();
  const page = Number(ctx.match[2]);
  await showJokePage(ctx, page);
});

// ── Remove joke flow ──
composer.callbackQuery("admin:removejoke", async (ctx) => {
  if (!(await gate(ctx))) return;
  ctx.session.step = "awaiting_joke_id";
  await ctx.editMessageText("Send me the ID of the joke you want to remove:", { reply_markup: backToMenu });
});

// ── Admin report ──
composer.callbackQuery("admin:report", async (ctx) => {
  if (!(await gate(ctx))) return;
  const schedule = await getSchedule();
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const logs = await getRecentSendLogs(todayStart);
  const successful = logs.filter(l => l.send_result).length;
  const failed = logs.length - successful;

  const msg = `📊 Broadcast Report\n\n` +
    `Today's time: ${schedule.daily_time_utc} UTC\n` +
    `Sent: ${successful} successful, ${failed} failed\n` +
    `Total attempts: ${logs.length}`;
  await ctx.editMessageText(msg, { reply_markup: backToMenu });
});

// ── Daily broadcast scheduler ──

export async function runDailyBroadcast(bot: { api: { sendMessage: (chatId: number, text: string) => Promise<unknown> } }): Promise<void> {
  const schedule = await getSchedule();
  const now = new Date();
  const nowUTC = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  if (nowUTC !== schedule.daily_time_utc) return;
  const lastDate = await getLastBroadcastDate();
  if (lastDate === todayStr) return;
  await setLastBroadcastDate(todayStr);

  const joke = await getRandomJoke();
  const jokeText = joke ? joke.text : "No joke available today — check back later!";
  const jokeId = joke ? joke.id : "none";

  const users = await getAllSubscribedUsers();
  let successful = 0;
  let failed = 0;
  const nowTs = Date.now();

  for (const user of users) {
    try {
      await bot.api.sendMessage(user.telegram_id, `📢 Daily Joke\n\n${jokeText}`);
      await addSendLog({ timestamp: nowTs, user_id: user.telegram_id, joke_id: jokeId, send_result: true });
      successful++;
    } catch {
      await addSendLog({ timestamp: nowTs, user_id: user.telegram_id, joke_id: jokeId, send_result: false });
      failed++;
    }
  }

  const admin = adminId();
  if (admin) {
    try {
      await bot.api.sendMessage(admin, `📊 Broadcast sent!\n${successful} successful, ${failed} failed out of ${users.length} subscribers.`);
    } catch {
      // Non-fatal
    }
  }
}

export function startDailyBroadcastScheduler(bot: { api: { sendMessage: (chatId: number, text: string) => Promise<unknown> } }): void {
  setInterval(() => {
    runDailyBroadcast(bot).catch((err) => {
      console.error("[jokebot] daily broadcast failed:", err);
    });
  }, 30_000);
}

export default composer;
