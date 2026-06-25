import { randomUUID } from "node:crypto";
import { load, save, remove, all, allKeys } from "./store.js";

export interface Joke {
  id: string;
  text: string;
  source: string;
  language: string;
}

const PREFIX = "joke";

const SEED_JOKES: Joke[] = [
  { id: randomUUID(), text: "Why don't scientists trust atoms? Because they make up everything!", source: "classic", language: "en" },
  { id: randomUUID(), text: "I told my wife she was drawing her eyebrows too high. She looked surprised.", source: "puns", language: "en" },
  { id: randomUUID(), text: "Parallel lines have so much in common. It's a shame they'll never meet.", source: "classic", language: "en" },
  { id: randomUUID(), text: "Why did the scarecrow win an award? Because he was outstanding in his field.", source: "classic", language: "en" },
  { id: randomUUID(), text: "I'm reading a book on anti-gravity. It's impossible to put down!", source: "puns", language: "en" },
  { id: randomUUID(), text: "What do you call a fake noodle? An impasta.", source: "dad", language: "en" },
  { id: randomUUID(), text: "Why did the bicycle fall over? It was two tired.", source: "dad", language: "en" },
  { id: randomUUID(), text: "What's orange and sounds like a parrot? A carrot.", source: "classic", language: "en" },
  { id: randomUUID(), text: "I used to play piano by ear, but now I use my hands.", source: "puns", language: "en" },
  { id: randomUUID(), text: "Why don't eggs tell jokes? They'd crack each other up.", source: "dad", language: "en" },
];

let seeded = false;

export function _resetForTest(): void {
  seeded = false;
}

export async function seedJokes(): Promise<void> {
  if (seeded) return;
  const existing = await allKeys(PREFIX);
  if (existing.length === 0) {
    for (const joke of SEED_JOKES) {
      await save(PREFIX, joke.id, joke);
    }
  }
  seeded = true;
}

export async function getAllJokes(): Promise<Joke[]> {
  await seedJokes();
  return all<Joke>(PREFIX);
}

export async function getJoke(id: string): Promise<Joke | undefined> {
  return load<Joke>(PREFIX, id);
}

export async function addJoke(joke: Joke): Promise<void> {
  await save(PREFIX, joke.id, joke);
}

export async function deleteJoke(id: string): Promise<void> {
  await remove(PREFIX, id);
}

export async function getRandomJoke(): Promise<Joke | null> {
  await seedJokes();
  const jokes = await getAllJokes();
  if (jokes.length === 0) return null;
  return jokes[Math.floor(Math.random() * jokes.length)]!;
}
