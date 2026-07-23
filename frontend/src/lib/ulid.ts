/**
 * lib/ulid.ts — tiny ULID generator (no deps).
 * Mirrors `src/ids.ts` from bundle 04. Used for traceId / spanId / row ids.
 */

const ENCODE = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford 32
const TIME_LEN = 10;
const RAND_LEN = 16;

let counter = 0;

export function ulid(): string {
  const now = Date.now();
  let time = now;
  const timePart: string[] = new Array(TIME_LEN);
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    timePart[i] = ENCODE[time % 32]!;
    time = Math.floor(time / 32);
  }
  const randPart: string[] = new Array(RAND_LEN);
  // Mix entropy: Math.random + counter + Date.now ms drift.
  let entropy = (Math.random() * 2 ** 31) ^ (counter++ << 4) ^ (now & 0xffff);
  for (let i = 0; i < RAND_LEN; i++) {
    randPart[i] = ENCODE[entropy % 32]!;
    entropy = Math.floor(entropy / 32) ^ (Math.floor(Math.random() * 2 ** 31));
  }
  return [...timePart, ...randPart].join('');
}
