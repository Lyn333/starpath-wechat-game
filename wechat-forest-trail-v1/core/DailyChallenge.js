function hash(value) {
  let current = 2166136261;
  for (let index = 0; index < value.length; index += 1) { current ^= value.charCodeAt(index); current = Math.imul(current, 16777619); }
  return current >>> 0;
}

function randomFrom(seed) {
  let state = hash(seed) || 1;
  return () => {
    state |= 0; state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function chinaDateKey(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

const CLOCK_TIERS = {
  easy: { id: "easy", label: "简单", gridSize: "6x6", difficulty: "easy" },
  medium: { id: "medium", label: "中等", gridSize: "8x8", difficulty: "medium" },
  hard: { id: "hard", label: "困难", gridSize: "10x10", difficulty: "hard" },
  expert: { id: "expert", label: "专家", gridSize: "12x12", difficulty: "hard" },
};

function createSeededLevel({ gridSize = "8x8", difficulty = "hard", seed, id, title, sourceKind = "seed" }) {
  const random = randomFrom(seed);
  const size = Number(gridSize.split("x")[0]);
  const transformed = Math.floor(random() * 8);
  const max = size - 1;
  const transform = (cell) => {
    if (transformed === 0) return cell;
    if (transformed === 1) return { row: cell.col, col: max - cell.row };
    if (transformed === 2) return { row: max - cell.row, col: max - cell.col };
    if (transformed === 3) return { row: max - cell.col, col: cell.row };
    if (transformed === 4) return { row: cell.row, col: max - cell.col };
    if (transformed === 5) return { row: max - cell.row, col: cell.col };
    if (transformed === 6) return { row: cell.col, col: cell.row };
    return { row: max - cell.col, col: max - cell.row };
  };
  const solution = [];
  for (let row = 0; row < size; row += 1) for (let index = 0; index < size; index += 1) solution.push(transform({ row, col: row % 2 ? max - index : index }));
  const waypointCount = { easy: Math.max(8, Math.floor(size * size / 10)), medium: Math.max(12, Math.floor(size * size / 7)), hard: Math.max(16, Math.floor(size * size / 5)) }[difficulty];
  const waypoints = [0];
  const span = (solution.length - 1) / (waypointCount - 1);
  for (let number = 2; number < waypointCount; number += 1) {
    const center = Math.round((number - 1) * span);
    const floor = waypoints[waypoints.length - 1] + 1;
    const ceiling = solution.length - 1 - (waypointCount - number);
    waypoints.push(Math.max(floor, Math.min(ceiling, center + Math.floor((random() - .5) * span * .5))));
  }
  waypoints.push(solution.length - 1);
  return { id, title, gridSize, difficulty, rows: size, cols: size, sourceKind, waypoints: waypoints.map((index, offset) => ({ number: offset + 1, cell: solution[index] })), walls: [], solution };
}

function createDailyChallenge(date = new Date()) {
  const day = chinaDateKey(date);
  const seed = `forest-trail:daily:v1:Asia/Shanghai:${day}`;
  const base = createSeededLevel({ gridSize: "8x8", difficulty: "hard", seed, id: `daily-${day}-${hash(seed).toString(16)}`, title: `每日挑战 · ${day}`, sourceKind: "daily" });
  return { ...base, challengeDate: day };
}

function createContinuation(gridSize, difficulty, ordinal) {
  const seed = `forest-trail:continuation:v1:${gridSize}:${difficulty}:${ordinal}`;
  return createSeededLevel({ gridSize, difficulty, seed, id: `continuation-${gridSize}-${difficulty}-${ordinal}-${hash(seed).toString(16)}`, title: `续关林径 · ${ordinal}`, sourceKind: "continuation" });
}

function createClockLevel(tierId, ordinal) {
  const tier = CLOCK_TIERS[tierId] || CLOCK_TIERS.easy;
  const seed = `forest-trail:clock:v1:${tier.id}:${ordinal}`;
  return { ...createSeededLevel({ gridSize: tier.gridSize, difficulty: tier.difficulty, seed, id: `clock-${tier.id}-${ordinal}-${hash(seed).toString(16)}`, title: `时间挑战 · ${tier.label} · ${ordinal}`, sourceKind: "clock" }), clockTier: tier.id, clockOrdinal: ordinal };
}

module.exports = { CLOCK_TIERS, chinaDateKey, createDailyChallenge, createContinuation, createClockLevel, createSeededLevel };
