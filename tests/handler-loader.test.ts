import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { buildBot } from "../src/bot.js";
import { runSpecs, parseBotSpec } from "../src/toolkit/index.js";
import { _resetStore, upsertUser, setSchedule, setLastBroadcastDate } from "../src/store.js";
import { runDailyBroadcast } from "../src/handlers/broadcast.js";

function loadSpecs(basename: string) {
  const raw = JSON.parse(
    readFileSync(new URL(`./specs/${basename}`, import.meta.url), "utf8"),
  ) as unknown[];
  return raw.map(parseBotSpec);
}

describe("buildBot handler loader", () => {
  beforeEach(() => _resetStore());

  it("loads src/handlers/start.ts so /start replies via the harness", async () => {
    const suite = await runSpecs(() => buildBot("test-token"), loadSpecs("start.json"));
    expect(suite.failed).toBe(0);
    expect(suite.passed).toBeGreaterThan(0);
  });

  it("unknown input falls through to the global fallback", async () => {
    const suite = await runSpecs(() => buildBot("test-token"), [
      parseBotSpec({
        name: "unknown text hits the fallback",
        steps: [
          { send: { text: "qwerty" },
            expect: [{ method: "sendMessage", payload: { text: "Sorry, I didn't understand that. Try /help." } }] },
        ],
      }),
    ]);
    expect(suite.failed).toBe(0);
  });

  it("loads src/handlers/joke.ts so /joke and joke button work", async () => {
    const suite = await runSpecs(() => buildBot("test-token"), loadSpecs("joke.json"));
    expect(suite.failed).toBe(0);
    expect(suite.passed).toBeGreaterThan(0);
  });

  it("loads src/handlers/subscribe.ts so /subscribe and button work", async () => {
    const suite = await runSpecs(() => buildBot("test-token"), loadSpecs("subscribe.json"));
    expect(suite.failed).toBe(0);
    expect(suite.passed).toBeGreaterThan(0);
  });

  it("loads src/handlers/unsubscribe.ts so /unsubscribe, /stop and button work", async () => {
    const suite = await runSpecs(() => buildBot("test-token"), loadSpecs("unsubscribe.json"));
    expect(suite.failed).toBe(0);
    expect(suite.passed).toBeGreaterThan(0);
  });

  it("loads src/handlers/broadcast.ts so admin callback flows work", async () => {
    process.env.ADMIN_TELEGRAM_ID = "1";
    try {
      const suite = await runSpecs(() => buildBot("test-token"), loadSpecs("broadcast.json"));
      expect(suite.failed).toBe(0);
      expect(suite.passed).toBeGreaterThan(0);
    } finally {
      delete process.env.ADMIN_TELEGRAM_ID;
    }
  });

  it("runDailyBroadcast sends jokes to subscribers and admin report", async () => {
    process.env.ADMIN_TELEGRAM_ID = "1";
    try {
      await upsertUser({ telegram_id: 100, display_name: "Alice", opt_out_flag: false });
      await upsertUser({ telegram_id: 200, display_name: "Bob", opt_out_flag: false });
      await upsertUser({ telegram_id: 300, display_name: "Charlie", opt_out_flag: true });

      const now = new Date();
      const nowUTC = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
      await setSchedule({ daily_time_utc: nowUTC });
      await setLastBroadcastDate("");

      const sentMessages: { chatId: number; text: string }[] = [];
      const mockBot = {
        api: {
          sendMessage: async (chatId: number, text: string) => {
            sentMessages.push({ chatId, text });
          },
        },
      };

      await runDailyBroadcast(mockBot);

      expect(sentMessages.filter(m => m.chatId === 100).length).toBe(1);
      expect(sentMessages.filter(m => m.chatId === 200).length).toBe(1);
      expect(sentMessages.filter(m => m.chatId === 300).length).toBe(0);
      expect(sentMessages.filter(m => m.chatId === 1).length).toBe(1);
      expect(sentMessages.length).toBe(3);

      const userMsg = sentMessages.find(m => m.chatId === 100)!;
      expect(userMsg.text).toContain("📢 Daily Joke");

      const adminMsg = sentMessages.find(m => m.chatId === 1)!;
      expect(adminMsg.text).toContain("Broadcast sent!");
      expect(adminMsg.text).toContain("2 successful");
    } finally {
      delete process.env.ADMIN_TELEGRAM_ID;
    }
  });

  it("runDailyBroadcast handles missing admin without error", async () => {
    await upsertUser({ telegram_id: 100, display_name: "Alice", opt_out_flag: false });

    const now = new Date();
    const nowUTC = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
    await setSchedule({ daily_time_utc: nowUTC });
    await setLastBroadcastDate("");

    const sentMessages: { chatId: number; text: string }[] = [];
    const mockBot = {
      api: {
        sendMessage: async (chatId: number, text: string) => {
          sentMessages.push({ chatId, text });
        },
      },
    };

    await runDailyBroadcast(mockBot);

    expect(sentMessages.filter(m => m.chatId === 100).length).toBe(1);
    expect(sentMessages.length).toBe(1);
  });
});
