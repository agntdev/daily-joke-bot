import { load, save, all, allKeys } from "./store.js";

export interface User {
  telegram_id: number;
  display_name: string;
  opt_out_flag: boolean;
}

const PREFIX = "user";

function idKey(telegramId: number): string {
  return String(telegramId);
}

export async function getUser(telegramId: number): Promise<User | undefined> {
  return load<User>(PREFIX, idKey(telegramId));
}

export async function upsertUser(user: User): Promise<void> {
  await save(PREFIX, idKey(user.telegram_id), user);
}

export async function getAllUsers(): Promise<User[]> {
  return all<User>(PREFIX);
}

export async function getSubscribedUsers(): Promise<User[]> {
  const users = await getAllUsers();
  return users.filter((u) => !u.opt_out_flag);
}

export async function isSubscribed(telegramId: number): Promise<boolean> {
  const user = await getUser(telegramId);
  if (!user) return false;
  return !user.opt_out_flag;
}

export async function subscribe(telegramId: number, displayName: string): Promise<void> {
  const existing = await getUser(telegramId);
  await upsertUser({
    telegram_id: telegramId,
    display_name: displayName,
    opt_out_flag: false,
  });
}

export async function unsubscribe(telegramId: number): Promise<void> {
  const existing = await getUser(telegramId);
  await upsertUser({
    telegram_id: telegramId,
    display_name: existing?.display_name ?? "Unknown",
    opt_out_flag: true,
  });
}

export async function userCount(): Promise<number> {
  const keys = await allKeys(PREFIX);
  return keys.length;
}

export async function subscribedCount(): Promise<number> {
  const users = await getSubscribedUsers();
  return users.length;
}
