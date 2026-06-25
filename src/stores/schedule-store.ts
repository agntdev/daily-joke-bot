import { load, save } from "./store.js";

export interface Schedule {
  daily_time_utc: string;
}

const PREFIX = "schedule";
const KEY = "broadcast";

const DEFAULT_SCHEDULE: Schedule = {
  daily_time_utc: "09:00",
};

export async function getSchedule(): Promise<Schedule> {
  const s = await load<Schedule>(PREFIX, KEY);
  return s ?? { ...DEFAULT_SCHEDULE };
}

export async function setSchedule(schedule: Schedule): Promise<void> {
  await save(PREFIX, KEY, schedule);
}

export async function setBroadcastTime(time: string): Promise<void> {
  await save(PREFIX, KEY, { daily_time_utc: time });
}
