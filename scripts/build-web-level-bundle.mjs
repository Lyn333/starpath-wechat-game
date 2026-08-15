import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const sourcePath = "/home/ubuntu/unlimited-puzzle-export/export/zip_unlimited_6x6_8x8_200.json";
const outputPath = path.join(projectDirectory, "client", "src", "game", "levelBundle.ts");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const forestNames = { easy: "林缘", medium: "林间", hard: "密林" };

function cellFromKey(key) {
  const [row, col] = key.split("-").map(Number);
  return { row, col };
}

const levels = source.exports.flatMap((group) => group.puzzles.map((puzzle, position) => {
  const ordinal = group.puzzles.slice(0, position + 1).filter((item) => item.difficulty === puzzle.difficulty).length;
  return {
    id: `forest-${puzzle.id}`,
    name: `${forestNames[puzzle.difficulty] || "林地"}路标 · ${String(ordinal).padStart(2, "0")}`,
    gridSize: group.gridSize,
    difficulty: puzzle.difficulty,
    size: group.rows,
    waypoints: Object.entries(puzzle.numberPositions).map(([key, number]) => ({ number: Number(number), cell: cellFromKey(key) })).sort((a, b) => a.number - b.number),
    walls: Array.isArray(puzzle.walls) ? puzzle.walls : [],
    solution: puzzle.path.map(cellFromKey),
  };
}));

if (levels.length !== 200) throw new Error(`期望200道关卡，实际得到${levels.length}道。`);
const output = `/** 自动生成：运行 scripts/build-web-level-bundle.mjs 更新。 */\nimport type { PuzzleDefinition } from "./types";\n\nexport type LevelDifficulty = "easy" | "medium" | "hard";\nexport interface ForestLevel extends PuzzleDefinition { gridSize: "6x6" | "8x8"; difficulty: LevelDifficulty; }\nexport const FOREST_LEVELS: ForestLevel[] = ${JSON.stringify(levels)};\nexport const LEVEL_COUNTS = { "6x6": 100, "8x8": 100, total: 200 } as const;\nexport function listForestLevels(gridSize: ForestLevel["gridSize"], difficulty: LevelDifficulty) { return FOREST_LEVELS.filter((level) => level.gridSize === gridSize && level.difficulty === difficulty); }\n`;
await writeFile(outputPath, output, "utf8");
console.log(`已生成网页端200关题库：${outputPath}`);
