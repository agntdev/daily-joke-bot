import type { StorageAdapter } from "grammy";
import { MemorySessionStorage, defaultRedisStorage } from "../toolkit/index.js";

type Stored = { v: string };

let _adapter: StorageAdapter<Stored> | null = null;

function adapter(): StorageAdapter<Stored> {
  if (!_adapter) {
    if (process.env.REDIS_URL) {
      _adapter = defaultRedisStorage<Stored>(process.env.REDIS_URL);
    } else {
      _adapter = new MemorySessionStorage<Stored>();
    }
  }
  return _adapter;
}

function key(prefix: string, id: string): string {
  return `__db:${prefix}:${id}`;
}

export async function load<T>(prefix: string, id: string): Promise<T | undefined> {
  const stored = await adapter().read(key(prefix, id));
  if (!stored) return undefined;
  try {
    return JSON.parse(stored.v) as T;
  } catch {
    return undefined;
  }
}

export async function save<T>(prefix: string, id: string, value: T): Promise<void> {
  await adapter().write(key(prefix, id), { v: JSON.stringify(value) });
}

export async function remove(prefix: string, id: string): Promise<void> {
  await adapter().delete(key(prefix, id));
}

export async function allKeys(prefix: string): Promise<string[]> {
  const fullPrefix = key(prefix, "");
  const stored = adapter();
  const result = await (stored.readAllKeys?.() ?? []);
  if (Array.isArray(result)) {
    return result.filter((k: string) => k.startsWith(fullPrefix)).map((k: string) => k.slice(fullPrefix.length));
  }
  if (Symbol.iterator in result) {
    return [...result].filter((k: string) => k.startsWith(fullPrefix)).map((k: string) => k.slice(fullPrefix.length));
  }
  if (Symbol.asyncIterator in result) {
    const keys: string[] = [];
    for await (const k of result as AsyncIterableIterator<string>) {
      if (typeof k === "string" && k.startsWith(fullPrefix)) keys.push(k.slice(fullPrefix.length));
    }
    return keys;
  }
  return [];
}

export async function all<T>(prefix: string): Promise<T[]> {
  const keys = await allKeys(prefix);
  const results: T[] = [];
  for (const k of keys) {
    const v = await load<T>(prefix, k);
    if (v !== undefined) results.push(v);
  }
  return results;
}

export function _resetForTest(): void {
  _adapter = null;
}
