import type { ForestLevel } from "./levelBundle";

export const LAUNCH_CATALOG_URL = "/manus-storage/forest-trail-launch-catalog-v1_1f05b218.json";

interface LaunchCatalogPayload {
  schemaVersion: number;
  total: number;
  levels: ForestLevel[];
}

function isForestLevel(value: unknown): value is ForestLevel {
  if (!value || typeof value !== "object") return false;
  const level = value as Partial<ForestLevel>;
  return typeof level.id === "string" && typeof level.name === "string" && typeof level.gridSize === "string" && typeof level.difficulty === "string" && typeof level.size === "number" && Array.isArray(level.waypoints) && Array.isArray(level.walls) && Array.isArray(level.solution);
}

export async function loadLaunchCatalog(fetcher: typeof fetch = fetch): Promise<ForestLevel[]> {
  const response = await fetcher(LAUNCH_CATALOG_URL);
  if (!response.ok) throw new Error(`无法加载首发题库：${response.status}`);
  const payload = await response.json() as LaunchCatalogPayload;
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.levels) || payload.total !== payload.levels.length || !payload.levels.every(isForestLevel)) {
    throw new Error("首发题库格式不正确");
  }
  return payload.levels;
}
