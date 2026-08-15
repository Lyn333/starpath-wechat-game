import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const sourcePath = "/home/ubuntu/unlimited-puzzle-export/export/zip_unlimited_6x6_8x8_200.json";
const outputPath = path.join(projectDirectory, "data", "levelBundle.js");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const labels = { easy: "林缘", medium: "林间", hard: "密林" };

function cellFromKey(key) {
  const [row, col] = key.split("-").map(Number);
  if (!Number.isInteger(row) || !Number.isInteger(col)) throw new Error(`无法解析格点：${key}`);
  return { row, col };
}

function assertLevel(level) {
  const expected = level.rows * level.cols;
  if (level.solution.length !== expected) throw new Error(`${level.id} 未覆盖完整棋盘。`);
  const visited = new Set();
  level.solution.forEach((cell, index) => {
    const key = `${cell.row}-${cell.col}`;
    if (cell.row < 0 || cell.row >= level.rows || cell.col < 0 || cell.col >= level.cols) throw new Error(`${level.id} 的路径越界。`);
    if (visited.has(key)) throw new Error(`${level.id} 的路径重复经过 ${key}。`);
    visited.add(key);
    if (index > 0) {
      const previous = level.solution[index - 1];
      if (Math.abs(previous.row - cell.row) + Math.abs(previous.col - cell.col) !== 1) throw new Error(`${level.id} 存在非正交移动。`);
    }
  });
  level.waypoints.forEach((waypoint, index) => {
    if (waypoint.number !== index + 1) throw new Error(`${level.id} 的路标编号不连续。`);
    if (!visited.has(`${waypoint.cell.row}-${waypoint.cell.col}`)) throw new Error(`${level.id} 路标不在路径上。`);
  });
}

const levels = source.exports.flatMap((group) => group.puzzles.map((puzzle, index) => {
  const difficultyIndex = group.puzzles.filter((item, position) => position <= index && item.difficulty === puzzle.difficulty).length;
  const waypoints = Object.entries(puzzle.numberPositions)
    .map(([key, number]) => ({ number: Number(number), cell: cellFromKey(key) }))
    .sort((a, b) => a.number - b.number);
  const level = {
    id: `forest-${puzzle.id}`,
    sourceId: puzzle.id,
    title: `${labels[puzzle.difficulty] || "林地"}路标 · ${String(difficultyIndex).padStart(2, "0")}`,
    gridSize: group.gridSize,
    difficulty: puzzle.difficulty,
    rows: group.rows,
    cols: group.cols,
    waypoints,
    walls: Array.isArray(puzzle.walls) ? puzzle.walls : [],
    solution: puzzle.path.map(cellFromKey),
  };
  assertLevel(level);
  return level;
}));

if (levels.length !== 200) throw new Error(`期望生成 200 关，实际得到 ${levels.length} 关。`);
const metadata = {
  version: 1,
  generatedAt: new Date().toISOString(),
  totalLevels: levels.length,
  groups: source.exports.map((group) => ({
    gridSize: group.gridSize,
    rows: group.rows,
    cols: group.cols,
    total: group.puzzles.length,
    difficultyCounts: Object.fromEntries(["easy", "medium", "hard"].map((difficulty) => [difficulty, group.puzzles.filter((puzzle) => puzzle.difficulty === difficulty).length])),
  })),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `/** 自动生成：请运行 scripts/build-level-bundle.mjs 更新；不要手动编辑。 */\nconst LEVEL_BUNDLE_METADATA = ${JSON.stringify(metadata, null, 2)};\nconst LEVELS = ${JSON.stringify(levels)};\n\nfunction getLevelById(id) { return LEVELS.find((level) => level.id === id) || null; }\nfunction listLevels(filters = {}) { return LEVELS.filter((level) => (!filters.gridSize || level.gridSize === filters.gridSize) && (!filters.difficulty || level.difficulty === filters.difficulty)); }\nmodule.exports = { LEVEL_BUNDLE_METADATA, LEVELS, getLevelById, listLevels };\n`, "utf8");

console.log(`已生成 ${levels.length} 道森林寻径关卡：${outputPath}`);
