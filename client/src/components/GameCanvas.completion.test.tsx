// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FOREST_LEVELS } from "@/game/levelBundle";
import { shuffleLaunchCatalog } from "@/game/randomLevelDraw";
import { createSeededPuzzle } from "@/game/seededPuzzle";
import type { GameSnapshot } from "@/game/types";

const { launchCatalogMock } = vi.hoisted(() => ({ launchCatalogMock: vi.fn() }));

vi.mock("@/game/launchCatalog", () => ({ loadLaunchCatalog: launchCatalogMock }));

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

const gameCanvasSource = readFileSync(path.resolve(import.meta.dirname, "GameCanvas.tsx"), "utf8");

describe("GameCanvas completion flow", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    launchCatalogMock.mockResolvedValue(FOREST_LEVELS);
  });

  it("does not render the failed completion decoration asset", () => {
    expect(gameCanvasSource).not.toContain("forestpath-completion-leaves");
    expect(gameCanvasSource).not.toContain("COMPLETION_URL");
  });

  it("reopens the library from an active game via the directory control", async () => {
    const { unmount } = render(<GameCanvas />);
    fireEvent.click(await screen.findByRole("button", { name: "随机抽取一条林径" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2400关关卡目录" })).toBeNull());
    await waitFor(() => expect(Object.keys(JSON.parse(window.localStorage.getItem("forest-trail-web-2400-progress-v1") ?? "{}")).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "关卡目录" }));
    expect(await screen.findByRole("dialog", { name: "2400关关卡目录" })).toBeTruthy();
    unmount();
  });

  it("keeps the randomized directory order stable when the library is closed and reopened in one session", async () => {
    const { unmount } = render(<GameCanvas />);
    await screen.findByText("FOREST TRAIL ARCHIVE · 200");
    const initialOrder = (await screen.findAllByRole("button", { name: /林缘路标/ })).map((button) => button.textContent);
    fireEvent.click(screen.getByRole("button", { name: "关闭关卡目录" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2400关关卡目录" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "关卡目录" }));
    const reopenedOrder = (await screen.findAllByRole("button", { name: /林缘路标/ })).map((button) => button.textContent);
    expect(reopenedOrder).toEqual(initialOrder);
    unmount();
  });

  it("offers a random draw control instead of a fixed unlock sequence", async () => {
    const { unmount } = render(<GameCanvas />);
    expect(await screen.findByRole("button", { name: "随机抽取一条林径" })).toBeTruthy();
    expect(screen.queryByText("待解锁")).toBeNull();
    unmount();
  });

  it("reopens the library after entering a 10×10 launch level", async () => {
    const tenByTen = createSeededPuzzle({ gridSize: "10x10", difficulty: "easy", seed: "component-10x10", ordinal: 1 });
    launchCatalogMock.mockResolvedValue([...FOREST_LEVELS, tenByTen]);
    const { unmount } = render(<GameCanvas />);
    fireEvent.click(screen.getByRole("button", { name: "10x10" }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(tenByTen.name) }));
    await waitFor(() => expect(screen.getByLabelText("林区信息").textContent).toContain("10x10"));
    fireEvent.click(screen.getByRole("button", { name: "关卡目录" }));
    expect(await screen.findByRole("dialog", { name: "2400关关卡目录" })).toBeTruthy();
    unmount();
  });

  it("loads the 12×12 launch level and receives demo-driven progress for demo=12", async () => {
    const twelveByTwelve = createSeededPuzzle({ gridSize: "12x12", difficulty: "easy", seed: "component-12x12", ordinal: 1 });
    window.history.replaceState({}, "", "/?demo=12");
    launchCatalogMock.mockResolvedValue([twelveByTwelve]);
    const { unmount } = render(<GameCanvas />);
    await waitFor(() => expect(screen.getByLabelText("林区信息").textContent).toContain("12x12"));
    await waitFor(() => expect(screen.getByText("踏步数").parentElement?.textContent).toContain("143"));
    unmount();
  });

  it("marks the final launch level complete and mints a saved seed continuation", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const terminalLevel = shuffleLaunchCatalog(FOREST_LEVELS, () => 0).find((level) => level.gridSize === "6x6" && level.difficulty === "easy")!;
    const group = FOREST_LEVELS.filter((level) => level.gridSize === terminalLevel.gridSize && level.difficulty === terminalLevel.difficulty);
    const priorProgress = Object.fromEntries(group.filter((level) => level.id !== terminalLevel.id).map((level) => [level.id, Date.now()]));
    window.localStorage.setItem("forest-trail-web-2400-progress-v1", JSON.stringify(priorProgress));

    const { unmount } = render(<GameCanvas />);
    await waitFor(() => expect(screen.getByLabelText("林区信息").textContent).toContain(terminalLevel.name));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("forest-trail-web-2400-progress-v1") ?? "{}")[terminalLevel.id]).toBeTruthy());
    fireEvent.click(await screen.findByRole("button", { name: "生成新林径" }));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("forest-trail-web-2400-continuations-v1") ?? "{}")[`${terminalLevel.gridSize}:${terminalLevel.difficulty}`]).toHaveLength(1));
    expect(screen.getByText(/种子林径/)).toBeTruthy();
    unmount();
    randomSpy.mockRestore();
  });
});
