import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(scriptDir, "..");
const catalogSource = "/home/ubuntu/webdev-static-assets/forest-trail-launch-catalog-v1.json";
const backgroundMusicSource = "/home/ubuntu/webdev-static-assets/forest-trail-audio/forest-trail-background.mp3";
const numberEffectSource = "/home/ubuntu/webdev-static-assets/forest-trail-audio/forest-trail-number-effect.mp3";
const outputDir = process.env.WECHAT_OUTPUT_DIR || "/home/ubuntu/wechat-forest-trail-v1-release";

function toNativeWall(wall) {
  const { cell, direction } = wall;
  if (direction === "right") return `V_${cell.row}_${cell.col}`;
  if (direction === "left") return `V_${cell.row}_${cell.col - 1}`;
  if (direction === "down") return `H_${cell.row}_${cell.col}`;
  if (direction === "up") return `H_${cell.row - 1}_${cell.col}`;
  throw new Error(`未知墙体方向：${direction}`);
}

export function toNativeLevel(level) {
  const size = Number(level.gridSize.split("x")[0]);
  return {
    id: level.id, title: level.name, gridSize: level.gridSize, difficulty: level.difficulty,
    rows: size, cols: size, sourceKind: "catalog", waypoints: level.waypoints, walls: (level.walls || []).map(toNativeWall), solution: level.solution,
  };
}

export function validate(level) {
  if (level.rows !== level.cols || level.solution.length !== level.rows * level.cols) throw new Error(`${level.id} 没有覆盖完整棋盘`);
  if (new Set(level.solution.map((cell) => `${cell.row}:${cell.col}`)).size !== level.solution.length) throw new Error(`${level.id} 有重复路径格`);
  level.solution.slice(1).forEach((cell, index) => { const previous = level.solution[index]; if (Math.abs(previous.row-cell.row)+Math.abs(previous.col-cell.col)!==1) throw new Error(`${level.id} 有非正交路径`); });
  level.waypoints.forEach((waypoint, index) => { if (waypoint.number !== index + 1) throw new Error(`${level.id} 路标不连续`); });
}

export async function buildMiniGamePackage({ destination = outputDir } = {}) {
  const payload = JSON.parse(await readFile(catalogSource, "utf8"));
  if (payload.schemaVersion !== 1 || payload.total !== 2400 || !Array.isArray(payload.levels)) throw new Error("首发题库不符合2400题发布规格");
  const levels = payload.levels.map(toNativeLevel); levels.forEach(validate);
  const totals = Object.fromEntries(["6x6", "8x8", "10x10", "12x12"].map((gridSize) => [gridSize, Object.fromEntries(["easy", "medium", "hard"].map((difficulty) => [difficulty, levels.filter((level) => level.gridSize === gridSize && level.difficulty === difficulty).length]))]));
  for (const counts of Object.values(totals)) if (counts.easy !== 300 || counts.medium !== 200 || counts.hard !== 100) throw new Error("首发分类数量不符合300/200/100规格");

  await rm(destination, { recursive: true, force: true });
  await cp(sourceDir, destination, { recursive: true, filter: (entry) => !entry.includes(`${path.sep}test`) && !entry.includes(`${path.sep}scripts`) && !entry.includes(`${path.sep}node_modules`) });
  await mkdir(path.join(destination, "audio"), { recursive: true });
  await cp(backgroundMusicSource, path.join(destination, "audio", "forest-trail-background.mp3"));
  await cp(numberEffectSource, path.join(destination, "audio", "forest-trail-number-effect.mp3"));
  await writeFile(path.join(destination, "audio", "game.js"), "/** 微信普通分包入口：背景音乐资源。 */\nmodule.exports = {};\n");
  await mkdir(path.join(destination, "catalog"), { recursive: true });
  const metadata = { version: "1.0.0", totalLevels: levels.length, difficultyTotals: totals, generatedAt: new Date().toISOString(), source: "forest-trail-launch-catalog-v1" };
  await writeFile(path.join(destination, "catalog", "game.js"), "/** 微信普通分包入口：题库在主包请求加载完成后按需 require。 */\nmodule.exports = {};\n");
  await writeFile(path.join(destination, "catalog", "launchCatalog.js"), `/** 自动生成的首发题库分包，请勿手动编辑。 */\nconst LEVEL_BUNDLE_METADATA = ${JSON.stringify(metadata)};\nconst LEVELS = ${JSON.stringify(levels)};\nmodule.exports = { LEVEL_BUNDLE_METADATA, LEVELS };\n`);
  const packageSize = (await stat(path.join(destination, "catalog", "launchCatalog.js"))).size;
  await stat(path.join(destination, "catalog", "game.js"));
  const backgroundMusicBytes = (await stat(path.join(destination, "audio", "forest-trail-background.mp3"))).size;
  const numberEffectBytes = (await stat(path.join(destination, "audio", "forest-trail-number-effect.mp3"))).size;
  await writeFile(path.join(destination, "release-manifest.json"), JSON.stringify({ ...metadata, packageSizeBytes: packageSize, appIdStatus: "configured-wx42d447652d8a5d07", audio: { backgroundMusic: { source: "user-provided-music", path: "audio/forest-trail-background.mp3", bytes: backgroundMusicBytes, loop: true }, numberEffect: { source: "user-provided-music", path: "audio/forest-trail-number-effect.mp3", bytes: numberEffectBytes, trigger: "next-waypoint-only" } } }, null, 2));
  console.log(`已生成微信小游戏发布包：${destination}\n主包代码已与 ${packageSize} 字节首发题库分离；已包含 ${backgroundMusicBytes} 字节循环背景音乐与 ${numberEffectBytes} 字节数字触达音效。`);
  return { destination, metadata, packageSize };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildMiniGamePackage();
