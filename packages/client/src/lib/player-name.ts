const PLAYER_NAME_KEY = "playerName";
const MAX_PLAYER_NAME_LENGTH = 16;

const PREFIXES = [
  "Nova",
  "Pixel",
  "Solar",
  "Turbo",
  "Echo",
  "Lucky",
  "Comet",
  "Jade",
];

const SUFFIXES = [
  "Fox",
  "Wolf",
  "Panda",
  "Otter",
  "Falcon",
  "Tiger",
  "Lynx",
  "Bear",
];

function randomItem(items: string[]) {
  return items[Math.floor(Math.random() * items.length)] ?? "Player";
}

function sanitizePlayerName(value: string | null | undefined) {
  return (value ?? "").trim().slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function generatePlayerName() {
  const number = String(Math.floor(100 + Math.random() * 900));
  return `${randomItem(PREFIXES)}${randomItem(SUFFIXES)}${number}`.slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function ensurePlayerName() {
  const existing = sanitizePlayerName(localStorage.getItem(PLAYER_NAME_KEY));
  if (existing) return existing;

  const generated = generatePlayerName();
  localStorage.setItem(PLAYER_NAME_KEY, generated);
  return generated;
}

export function getPlayerName() {
  return ensurePlayerName();
}

export function setPlayerName(value: string) {
  const next = sanitizePlayerName(value) || ensurePlayerName();
  localStorage.setItem(PLAYER_NAME_KEY, next);
  return next;
}
