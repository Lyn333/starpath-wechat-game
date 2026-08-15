// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FOREST_LEVELS } from "@/game/levelBundle";
import type { GameSnapshot } from "@/game/types";

vi.mock("@babylonjs/core/Engines/engine", () => ({
  Engine: class {
    runRenderLoop() {}
    resize() {}
    dispose() {}
  },
}));

vi.mock("@/game/scene", () => ({
  createGameScene: async (_engine: unknown, _canvas: unknown, options: { puzzle: { solution: GameSnapshot["path"]; waypoints: unknown[] }; onStateChange?: (snapshot: GameSnapshot) => void }) => {
    const snapshot: GameSnapshot = {
      path: options.puzzle.solution,
      status: "completed",
      nextWaypoint: options.puzzle.waypoints.length + 1,
      elapsedMs: 3500,
      moves: Math.max(0, options.puzzle.solution.length - 1),
      message: "林径走通。整片林地已留下完整脚印。",
      hintCells: [],
    };
    queueMicrotask(() => options.onStateChange?.(snapshot));
    return {
      dispose: () => undefined,
      getSnapshot: () => snapshot,
      scene: { render: () => undefined },
      pathEngine: { undo: () => undefined, reset: () => undefined, showHint: () => undefined },
    };
  },
}));

import GameCanvas from "./GameCanvas";

describe("GameCanvas completion flow", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns from the completed final real level to the library and refreshes its done state", async () => {
    const firstLevel = FOREST_LEVELS[0];
    const group = FOREST_LEVELS.filter((level) => level.gridSize === firstLevel.gridSize && level.difficulty === firstLevel.difficulty);
    const terminalLevel = group[group.length - 1];
    const priorProgress = Object.fromEntries(group.slice(0, -1).map((level) => [level.id, Date.now()]));
    window.localStorage.setItem("forest-trail-web-200-progress-v1", JSON.stringify(priorProgress));

    const { unmount } = render(<GameCanvas />);
    for (let page = 0; page < Math.floor((group.length - 1) / 12); page += 1) {
      fireEvent.click(screen.getByRole("button", { name: "下一页 →" }));
    }
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(terminalLevel.name) }));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("forest-trail-web-200-progress-v1") ?? "{}")[terminalLevel.id]).toBeTruthy());
    const returnButton = await screen.findByRole("button", { name: "返回目录" });
    fireEvent.click(returnButton);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "200关关卡目录" })).toBeTruthy());
    expect(screen.getByRole("button", { name: new RegExp(terminalLevel.name) }).textContent).toContain("已走通");
    unmount();
  });
});
