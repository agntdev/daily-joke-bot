import { createRequire } from "node:module";

// ── Persistent domain data store (Redis-backed, in-memory fallback) ──

export interface UserRecord {
  telegram_id: number;
  display_name: string;
  opt_out_flag: boolean;
}

export interface JokeRecord {
  id: string;
  text: string;
  source: string;
  language: string;
}

export interface SendLogEntry {
  timestamp: number;
  user_id: number;
  joke_id: string;
  send_result: boolean;
}

export interface BroadcastSchedule {
  daily_time_utc: string;
}

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  hset(key: string, ...args: string[]): Promise<unknown>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  srandmember(key: string, count?: number): Promise<string[]>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, ...members: string[]): Promise<unknown>;
  rpush(key: string, ...values: string[]): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  keys(pattern: string): Promise<string[]>;
  scard(key: string): Promise<number>;
}

const PREFIX = "jokebot:";
const USER_KEY = (id: number) => `${PREFIX}user:${id}`;
const JOKE_KEY = (id: string) => `${PREFIX}joke:${id}`;
const JOKE_SET = `${PREFIX}jokes`;
const LOG_KEY = `${PREFIX}sendlog`;
const SCHEDULE_KEY = `${PREFIX}schedule`;
const LAST_BROADCAST_KEY = `${PREFIX}lastbroadcast`;

let _client: RedisLike | null = null;

function getRedisClient(): RedisLike | null {
  if (_client !== null) return _client;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return (_client = undefined as unknown as RedisLike); // in-memory fallback
  const require = createRequire(import.meta.url);
  const ioredis: any = require("ioredis");
  const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
  const client = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
  _client = client as RedisLike;
  return _client;
}

function client(): RedisLike | null {
  if (_client === null) return getRedisClient();
  if (_client === (undefined as unknown as RedisLike)) return null;
  return _client;
}

// In-memory fallback store
const memUsers = new Map<string, UserRecord>();
const memJokes = new Map<string, JokeRecord>();
const memLogs: SendLogEntry[] = [];
let memSchedule: BroadcastSchedule = { daily_time_utc: "09:00" };
let memLastBroadcast = "";

const SEED_JOKES: JokeRecord[] = [
  { id: "1", text: "Why don't scientists trust atoms? Because they make up everything!", source: "classic", language: "en" },
  { id: "2", text: "I told my wife she was drawing her eyebrows too high. She looked surprised.", source: "dad", language: "en" },
  { id: "3", text: "Parallel lines have so much in common. It's a shame they'll never meet.", source: "math", language: "en" },
  { id: "4", text: "What do you call a fake noodle? An impasta.", source: "food", language: "en" },
  { id: "5", text: "Why did the scarecrow win an award? Because he was outstanding in his field.", source: "farm", language: "en" },
];

async function seedJokes(): Promise<void> {
  const c = client();
  if (c) {
    const count = await c.scard(JOKE_SET);
    if (count > 0) return;
    for (const j of SEED_JOKES) {
      await c.hset(JOKE_KEY(j.id), "id", j.id, "text", j.text, "source", j.source, "language", j.language);
      await c.sadd(JOKE_SET, j.id);
    }
  } else {
    if (memJokes.size > 0) return;
    for (const j of SEED_JOKES) {
      memJokes.set(j.id, j);
    }
  }
}

// ─── Users ─────────────────────────────────────────
export async function getUser(telegramId: number): Promise<UserRecord | undefined> {
  const c = client();
  if (c) {
    const raw = await c.hgetall(USER_KEY(telegramId));
    if (!raw || Object.keys(raw).length === 0) return undefined;
    return {
      telegram_id: Number(raw.telegram_id),
      display_name: raw.display_name,
      opt_out_flag: raw.opt_out_flag === "true",
    };
  }
  return memUsers.get(String(telegramId));
}

export async function upsertUser(user: UserRecord): Promise<void> {
  const c = client();
  if (c) {
    await c.hset(USER_KEY(user.telegram_id), "telegram_id", String(user.telegram_id), "display_name", user.display_name, "opt_out_flag", String(user.opt_out_flag));
  } else {
    memUsers.set(String(user.telegram_id), { ...user });
  }
}

export async function getAllSubscribedUsers(): Promise<UserRecord[]> {
  const c = client();
  if (c) {
    const keys = await c.keys(USER_KEY(0).replace("0", "*"));
    const users: UserRecord[] = [];
    for (const k of keys) {
      const raw = await c.hgetall(k);
      if (raw.opt_out_flag !== "true") {
        users.push({ telegram_id: Number(raw.telegram_id), display_name: raw.display_name, opt_out_flag: false });
      }
    }
    return users;
  }
  const users: UserRecord[] = [];
  for (const u of memUsers.values()) {
    if (!u.opt_out_flag) users.push({ ...u });
  }
  return users;
}

// ─── Jokes ─────────────────────────────────────────
export async function getRandomJoke(): Promise<JokeRecord | null> {
  await seedJokes();
  const c = client();
  if (c) {
    const [id] = await c.srandmember(JOKE_SET, 1);
    if (!id) return null;
    const raw = await c.hgetall(JOKE_KEY(id));
    return { id: raw.id, text: raw.text, source: raw.source, language: raw.language };
  }
  const ids = [...memJokes.keys()];
  if (ids.length === 0) return null;
  const id = ids[Math.floor(Math.random() * ids.length)];
  const j = memJokes.get(id)!;
  return { ...j };
}

export async function getAllJokes(): Promise<JokeRecord[]> {
  await seedJokes();
  const c = client();
  if (c) {
    const ids = await c.smembers(JOKE_SET);
    const jokes: JokeRecord[] = [];
    for (const id of ids) {
      const raw = await c.hgetall(JOKE_KEY(id));
      jokes.push({ id: raw.id, text: raw.text, source: raw.source, language: raw.language });
    }
    return jokes;
  }
  return [...memJokes.values()].map(j => ({ ...j }));
}

export async function addJoke(joke: JokeRecord): Promise<void> {
  const c = client();
  if (c) {
    await c.hset(JOKE_KEY(joke.id), "id", joke.id, "text", joke.text, "source", joke.source, "language", joke.language);
    await c.sadd(JOKE_SET, joke.id);
  } else {
    memJokes.set(joke.id, { ...joke });
  }
}

export async function removeJoke(id: string): Promise<boolean> {
  const c = client();
  if (c) {
    const raw = await c.hgetall(JOKE_KEY(id));
    if (!raw || Object.keys(raw).length === 0) return false;
    await c.del(JOKE_KEY(id));
    await c.srem(JOKE_SET, id);
    return true;
  }
  return memJokes.delete(id);
}

export async function jokeCount(): Promise<number> {
  const c = client();
  if (c) return await c.scard(JOKE_SET);
  return memJokes.size;
}

// ─── Send Log ──────────────────────────────────────
export async function addSendLog(entry: SendLogEntry): Promise<void> {
  const data = JSON.stringify(entry);
  const c = client();
  if (c) {
    await c.rpush(LOG_KEY, data);
  } else {
    memLogs.push(entry);
  }
}

export async function getRecentSendLogs(sinceTimestamp: number): Promise<SendLogEntry[]> {
  const c = client();
  if (c) {
    const raw = await c.lrange(LOG_KEY, 0, -1);
    return raw.map(r => JSON.parse(r) as SendLogEntry).filter(l => l.timestamp >= sinceTimestamp);
  }
  return memLogs.filter(l => l.timestamp >= sinceTimestamp);
}

export async function getAllSendLogs(): Promise<SendLogEntry[]> {
  const c = client();
  if (c) {
    const raw = await c.lrange(LOG_KEY, 0, -1);
    return raw.map(r => JSON.parse(r) as SendLogEntry);
  }
  return [...memLogs];
}

// ─── Schedule ─────────────────────────────────────
export async function getSchedule(): Promise<BroadcastSchedule> {
  const c = client();
  if (c) {
    const raw = await c.hgetall(SCHEDULE_KEY);
    if (!raw || Object.keys(raw).length === 0) return { daily_time_utc: "09:00" };
    return { daily_time_utc: raw.daily_time_utc };
  }
  return { ...memSchedule };
}

export async function setSchedule(schedule: BroadcastSchedule): Promise<void> {
  const c = client();
  if (c) {
    await c.hset(SCHEDULE_KEY, "daily_time_utc", schedule.daily_time_utc);
  } else {
    memSchedule = { ...schedule };
  }
}

// ─── Last Broadcast Date ──────────────────────────
export async function getLastBroadcastDate(): Promise<string> {
  const c = client();
  if (c) {
    const raw = await c.get(LAST_BROADCAST_KEY);
    return raw ?? "";
  }
  return memLastBroadcast;
}

export async function setLastBroadcastDate(date: string): Promise<void> {
  const c = client();
  if (c) {
    await c.set(LAST_BROADCAST_KEY, date);
  } else {
    memLastBroadcast = date;
  }
}

/** Reset in-memory state. Test-only hook. */
export function _resetStore(): void {
  _client = null;
  memUsers.clear();
  memJokes.clear();
  memLogs.length = 0;
  memSchedule = { daily_time_utc: "09:00" };
  memLastBroadcast = "";
}
