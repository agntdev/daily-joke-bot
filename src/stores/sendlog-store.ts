import { save, all } from "./store.js";

export interface SendLog {
  timestamp: number;
  user_id: number;
  joke_id: string;
  send_result: "ok" | "error";
}

const PREFIX = "sendlog";

function idKey(userId: number, jokeId: string, timestamp: number): string {
  return `${timestamp}_${userId}_${jokeId}`;
}

export async function addLog(log: SendLog): Promise<void> {
  await save(PREFIX, idKey(log.user_id, log.joke_id, log.timestamp), log);
}

export async function getAllLogs(): Promise<SendLog[]> {
  return all<SendLog>(PREFIX);
}

export async function getRecentLogs(since: number): Promise<SendLog[]> {
  const logs = await getAllLogs();
  return logs.filter((l) => l.timestamp >= since).sort((a, b) => b.timestamp - a.timestamp);
}

export async function getLogsForBroadcast(timestampThreshold: number): Promise<SendLog[]> {
  const logs = await getAllLogs();
  return logs.filter((l) => l.timestamp >= timestampThreshold);
}
