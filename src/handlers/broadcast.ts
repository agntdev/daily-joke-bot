import { Composer } from "grammy";
import type { Bot } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getRandomJoke } from "../stores/joke-store.js";
import { getSubscribedUsers } from "../stores/user-store.js";
import { addLog, type SendLog } from "../stores/sendlog-store.js";
import { getSchedule } from "../stores/schedule-store.js";
import { load, save } from "../stores/store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

let broadcastBot: Bot<Ctx> | null = null;
let broadcastLock = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

function adminId(): number | null {
  const raw = process.env.ADMIN_USER_ID;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function sendAdminReport(report: string): Promise<void> {
  const aid = adminId();
  if (!aid || !broadcastBot) return;
  try {
    await broadcastBot.api.sendMessage(aid, report);
  } catch {
    // Non-fatal: admin may not have started the bot yet
  }
}

function todayKey(): string {
  const now = new Date();
  return `__broadcast_date:${now.toISOString().slice(0, 10)}`;
}

async function broadcastDoneToday(): Promise<boolean> {
  const v = await load<string>("__broadcast_marker", todayKey());
  return v === "1";
}

async function markBroadcastDone(): Promise<void> {
  await save("__broadcast_marker", todayKey(), "1");
}

async function doBroadcast(): Promise<string> {
  const joke = await getRandomJoke();
  if (!joke) {
    const msg = "⚠️ Broadcast skipped: no jokes in the repository.";
    await sendAdminReport(msg);
    return msg;
  }

  const users = await getSubscribedUsers();
  if (users.length === 0) {
    const msg = "📭 Broadcast skipped: no subscribed users.";
    await sendAdminReport(msg);
    return msg;
  }

  const ts = Date.now();
  let ok = 0;
  let fail = 0;

  for (const user of users) {
    const log: SendLog = {
      timestamp: ts,
      user_id: user.telegram_id,
      joke_id: joke.id,
      send_result: "error",
    };
    try {
      if (broadcastBot) {
        await broadcastBot.api.sendMessage(user.telegram_id, `📅 Daily Joke\n\n${joke.text}`);
        log.send_result = "ok";
        ok++;
      } else {
        fail++;
      }
    } catch {
      fail++;
    }
    await addLog(log);
  }

  await markBroadcastDone();

  const report =
    `📊 Broadcast report\n` +
    `Joke: ${joke.text.slice(0, 80)}…\n` +
    `Sent: ${ok} ok, ${fail} failed\n` +
    `Recipients: ${users.length}`;

  await sendAdminReport(report);
  return report;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

async function tick(): Promise<void> {
  if (broadcastLock || !broadcastBot) return;
  const schedule = await getSchedule();
  const now = new Date();
  const currentTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  if (currentTime !== schedule.daily_time_utc) return;
  if (await broadcastDoneToday()) return;
  broadcastLock = true;
  try {
    await doBroadcast();
  } catch (err) {
    const msg = `❌ Broadcast error: ${err instanceof Error ? err.message : String(err)}`;
    await sendAdminReport(msg);
  } finally {
    broadcastLock = false;
  }
}

export function startBroadcastScheduler(bot: Bot<Ctx>): void {
  if (intervalId) return;
  broadcastBot = bot;
  intervalId = setInterval(() => {
    tick().catch(() => {});
  }, 60_000);
}

/** Manual broadcast trigger - callback for admin. */
composer.callbackQuery("broadcast:trigger", async (ctx) => {
  await ctx.answerCallbackQuery();
  const aid = adminId();
  if (aid !== null && ctx.from?.id !== aid) {
    await ctx.editMessageText("⛔ This action is restricted to the bot owner.", { reply_markup: backToMenu });
    return;
  }
  // Use ctx.api to send messages - works under the real bot and the harness
  const api = ctx.api;
  const joke = await getRandomJoke();
  if (!joke) {
    await ctx.editMessageText("⚠️ No jokes in the repository.", { reply_markup: backToMenu });
    return;
  }
  const users = await getSubscribedUsers();
  if (users.length === 0) {
    await ctx.editMessageText("📭 No subscribed users.", { reply_markup: backToMenu });
    return;
  }
  const ts = Date.now();
  let ok = 0;
  let fail = 0;
  for (const user of users) {
    const log: SendLog = {
      timestamp: ts,
      user_id: user.telegram_id,
      joke_id: joke.id,
      send_result: "error",
    };
    try {
      await api.sendMessage(user.telegram_id, `📅 Daily Joke\n\n${joke.text}`);
      log.send_result = "ok";
      ok++;
    } catch {
      fail++;
    }
    await addLog(log);
  }
  await markBroadcastDone();
  const report =
    `📊 Broadcast report\n` +
    `Joke: ${joke.text.slice(0, 80)}…\n` +
    `Sent: ${ok} ok, ${fail} failed\n` +
    `Recipients: ${users.length}`;
  await sendAdminReport(report);
  await ctx.editMessageText(`✅ Broadcast complete.\n\n${report}`, { reply_markup: backToMenu });
});

export default composer;
