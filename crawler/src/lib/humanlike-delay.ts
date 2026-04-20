export function randomDelayMs(min: number, max: number): number {
  if (min > max) throw new Error(`min(${min}) > max(${max})`);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
