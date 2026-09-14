function hashString(value) {
  const text = String(value ?? "");
  let current = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    current ^= text.charCodeAt(index);
    current = Math.imul(current, 16777619);
  }
  return current >>> 0;
}

function createSeededRandom(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickIndex(random, length) {
  if (!Number.isInteger(length) || length <= 0) throw new Error("pickIndex 需要非空集合。");
  return Math.min(length - 1, Math.floor(random() * length));
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = pickIndex(random, index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

module.exports = { createSeededRandom, hashString, pickIndex, shuffle };
