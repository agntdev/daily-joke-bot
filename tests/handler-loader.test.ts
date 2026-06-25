import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { buildBot } from "../src/bot.js";
import { runSpecs, parseBotSpec } from "../src/toolkit/index.js";
import { _resetStore } from "../src/store.js";

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
});
