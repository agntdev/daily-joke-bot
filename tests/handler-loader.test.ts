import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildBot } from "../src/bot.js";
import { runSpecs, parseBotSpec, formatSuiteResult } from "../src/toolkit/index.js";

describe("buildBot handler loader", () => {
  it("loads src/handlers/start.ts so /start replies via the harness", async () => {
    const raw = JSON.parse(
      readFileSync(new URL("./specs/start.json", import.meta.url), "utf8"),
    ) as unknown[];
    const specs = raw.map(parseBotSpec);
    const suite = await runSpecs(() => buildBot("test-token"), specs);
    console.log(formatSuiteResult(suite));
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
    console.log(formatSuiteResult(suite));
    expect(suite.failed).toBe(0);
  });

  it("loads joke handler so /joke replies", async () => {
    const raw = JSON.parse(
      readFileSync(new URL("./specs/joke.json", import.meta.url), "utf8"),
    ) as unknown[];
    const specs = raw.map(parseBotSpec);
    const suite = await runSpecs(() => buildBot("test-token"), specs);
    console.log(formatSuiteResult(suite));
    expect(suite.failed).toBe(0);
    expect(suite.passed).toBeGreaterThan(0);
  });

  it("loads subscribe handler", async () => {
    const raw = JSON.parse(
      readFileSync(new URL("./specs/subscribe.json", import.meta.url), "utf8"),
    ) as unknown[];
    const specs = raw.map(parseBotSpec);
    const suite = await runSpecs(() => buildBot("test-token"), specs);
    console.log(formatSuiteResult(suite));
    expect(suite.failed).toBe(0);
    expect(suite.passed).toBeGreaterThan(0);
  });
});
