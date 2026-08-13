import type { Cell, GridSize, LevelSnapshot } from "./levelSchema";

export type EditorTool = "solution" | "waypoint" | "wallH" | "wallV" | "erase";

export function cellKey(cell: Cell) {
  return `${cell.row}-${cell.col}`;
}

function isAdjacent(a: Cell, b: Cell) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function renumberWaypoints(waypoints: LevelSnapshot["waypoints"]) {
  return [...waypoints].sort((a, b) => a.number - b.number).map((waypoint, index) => ({ ...waypoint, number: index + 1 }));
}

export function makeStarterSnapshot(gridSize: GridSize): LevelSnapshot {
  const size = Number(gridSize.split("x")[0]);
  const solution: Cell[] = [];
  for (let row = 0; row < size; row += 1) {
    const columns = Array.from({ length: size }, (_, index) => index);
    if (row % 2) columns.reverse();
    columns.forEach((col) => solution.push({ row, col }));
  }
  const markers = [0, Math.floor(solution.length * 0.24), Math.floor(solution.length * 0.5), Math.floor(solution.length * 0.76), solution.length - 1];
  return { rows: size, cols: size, solution, walls: [], waypoints: markers.map((index, marker) => ({ number: marker + 1, cell: solution[index] })) };
}

export function applyEditorCellEdit(current: LevelSnapshot, cell: Cell, tool: EditorTool): { snapshot: LevelSnapshot; message?: string } {
  if (tool === "solution") {
    const existingIndex = current.solution.findIndex((item) => cellKey(item) === cellKey(cell));
    if (existingIndex !== -1) {
      const shortenedPath = current.solution.slice(0, existingIndex + 1);
      return { snapshot: { ...current, solution: shortenedPath, waypoints: renumberWaypoints(current.waypoints.filter((point) => shortenedPath.some((pathCell) => cellKey(pathCell) === cellKey(point.cell)))) } };
    }
    const tail = current.solution.at(-1);
    if (tail && !isAdjacent(tail, cell)) return { snapshot: current, message: "解法只能继续到上下左右相邻格；点击路径中的旧格可回退。" };
    return { snapshot: { ...current, solution: [...current.solution, cell] } };
  }
  if (tool === "waypoint") {
    const atCell = current.waypoints.find((point) => cellKey(point.cell) === cellKey(cell));
    if (atCell) return { snapshot: { ...current, waypoints: renumberWaypoints(current.waypoints.filter((point) => point !== atCell)) } };
    if (!current.solution.some((pathCell) => cellKey(pathCell) === cellKey(cell))) return { snapshot: current, message: "路标必须设置在已绘制的解法路径上。" };
    const number = current.waypoints.reduce((largest, marker) => Math.max(largest, marker.number), 0) + 1;
    return { snapshot: { ...current, waypoints: [...current.waypoints, { number, cell }].sort((a, b) => a.number - b.number) } };
  }
  if (tool === "wallH") {
    if (cell.row >= current.rows - 1) return { snapshot: current };
    const wall = `H_${cell.row}_${cell.col}`;
    return { snapshot: { ...current, walls: current.walls.includes(wall) ? current.walls.filter((item) => item !== wall) : [...current.walls, wall] } };
  }
  if (tool === "wallV") {
    if (cell.col >= current.cols - 1) return { snapshot: current };
    const wall = `V_${cell.row}_${cell.col}`;
    return { snapshot: { ...current, walls: current.walls.includes(wall) ? current.walls.filter((item) => item !== wall) : [...current.walls, wall] } };
  }
  return {
    snapshot: {
      ...current,
      solution: current.solution.filter((pathCell) => cellKey(pathCell) !== cellKey(cell)),
      waypoints: renumberWaypoints(current.waypoints.filter((point) => cellKey(point.cell) !== cellKey(cell))),
      walls: current.walls.filter((wall) => wall !== `H_${cell.row}_${cell.col}` && wall !== `V_${cell.row}_${cell.col}`),
    },
  };
}
