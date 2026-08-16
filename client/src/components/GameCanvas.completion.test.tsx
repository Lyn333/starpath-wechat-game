// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FOREST_LEVELS } from "@/game/levelBundle";
import { shuffleLaunchCatalog } from "@/game/randomLevelDraw";
import { createSeededPuzzle } from "@/game/seededPuzzle";
import { CONTROL_STACK_METRICS, deriveControlStackLayout } from "@/game/controlStackLayout";
import type { GameSnapshot } from "@/game/types";

const { launchCatalogMock } = vi.hoisted(() => ({ launchCatalogMock: vi.fn() }));

vi.mock("@/game/launchCatalog", () => ({ loadLaunchCatalog: launchCatalogMock }));
vi.mock("@babylonjs/core/Engines/engine", () => ({
  Engine: class { runRenderLoop() {} resize() {} dispose() {} },
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
    return { dispose: () => undefined, getSnapshot: () => snapshot, scene: { render: () => undefined }, pathEngine: { undo: () => undefined, reset: () => undefined, showHint: () => undefined } };
  },
}));

import GameCanvas from "./GameCanvas";

const gameCanvasSource = readFileSync(path.resolve(import.meta.dirname, "GameCanvas.tsx"), "utf8");
const indexCssSource = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");

describe("GameCanvas single-board flow", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    launchCatalogMock.mockResolvedValue(FOREST_LEVELS);
  });

  it("does not render the removed library layer or failed decoration asset", () => {
    expect(gameCanvasSource).not.toContain("forestpath-completion-leaves");
    expect(gameCanvasSource).not.toContain("2400关关卡目录");
  });

  it("shows only the current board, compact controls, and size plus difficulty selectors", async () => {
    const { unmount } = render(<GameCanvas />);
    expect(await screen.findByLabelText("可触摸操作的当前谜题棋盘")).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /撤回/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /清空/ })).toBeTruthy();
    const difficultyGroup = screen.getByRole("group", { name: "选择难度" });
    expect(difficultyGroup.classList.contains("difficulty-choice-row")).toBe(true);
    expect(screen.getByRole("button", { name: "简单" }).querySelector(".difficulty-icon-easy")).not.toBeNull();
    expect(screen.getByRole("button", { name: "中等" }).querySelector(".difficulty-icon-medium")).not.toBeNull();
    expect(screen.getByRole("button", { name: "困难" }).querySelector(".difficulty-icon-hard")).not.toBeNull();
    expect(indexCssSource).toContain(".difficulty-icon-easy::before");
    expect(indexCssSource).toContain(".difficulty-icon-medium::before");
    expect(indexCssSource).toContain(".difficulty-icon-hard::after");
    expect(indexCssSource).toContain(".solo-choice-row button.selected .difficulty-icon-hard::after");
    expect(indexCssSource).toContain(".difficulty-choice-row { grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 8px; }");
    expect(indexCssSource).toContain("--board-bottom: var(--actual-board-bottom); --action-row-height: 40px; --picker-row-height: 43px; --control-stack-gap: 8px;");
    expect(indexCssSource).toContain("--action-row-height: 30px; --picker-row-height: 37px; --control-stack-gap: 8px;");
    expect(indexCssSource).toContain(".solo-control-stack { position: absolute; z-index: 3; top: calc(var(--board-bottom) + var(--control-stack-gap));");
    expect(screen.getByRole("group", { name: "选择棋盘尺寸" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "6x6" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "8x8" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "10x10" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "12x12" })).toBeTruthy();
    expect(screen.queryByText("难度 · 随棋盘尺寸变化")).toBeNull();
    expect(screen.queryByText("棋盘尺寸")).toBeNull();
    expect(indexCssSource).toContain(".solo-picker { display: grid; gap: var(--control-stack-gap); width: 100%; }");
    const controlStack = screen.getByLabelText("棋盘控制区");
    expect(controlStack.querySelector(".solo-board-actions")).not.toBeNull();
    expect(controlStack.querySelector(".solo-picker")).not.toBeNull();
    expect(screen.queryByRole("dialog", { name: "2400关关卡目录" })).toBeNull();
    unmount();
  });

  it("randomly enters one puzzle for the selected difficulty and grid size without showing a collection", async () => {
    const tenByTenMedium = createSeededPuzzle({ gridSize: "10x10", difficulty: "medium", seed: "single-board-10x10", ordinal: 1 });
    launchCatalogMock.mockResolvedValue([...FOREST_LEVELS, tenByTenMedium]);
    const { unmount } = render(<GameCanvas />);
    await screen.findByRole("button", { name: "中等" });
    fireEvent.click(screen.getByRole("button", { name: "中等" }));
    await waitFor(() => expect(screen.getByLabelText("当前谜题状态").textContent).toContain("中等 6x6"));
    fireEvent.click(screen.getByRole("button", { name: "10x10" }));
    await waitFor(() => expect(screen.getByLabelText("当前谜题状态").textContent).toContain("中等 10x10"));
    expect(screen.queryByText(tenByTenMedium.name)).toBeNull();
    expect(screen.queryByRole("dialog", { name: "2400关关卡目录" })).toBeNull();
    unmount();
  });

  it("loads the 12×12 demo selection into the single-board flow", async () => {
    const twelveByTwelve = createSeededPuzzle({ gridSize: "12x12", difficulty: "easy", seed: "single-board-12x12", ordinal: 1 });
    window.history.replaceState({}, "", "/?demo=12");
    launchCatalogMock.mockResolvedValue([twelveByTwelve]);
    const { unmount } = render(<GameCanvas />);
    await waitFor(() => expect(screen.getByLabelText("当前谜题状态").textContent).toContain("简单 12x12"));
    await waitFor(() => expect(screen.getByText(/Points:/).textContent).not.toContain("Points: 0"));
    unmount();
  });

  it.each(Object.entries(CONTROL_STACK_METRICS))("keeps the DOM control sequence evenly spaced in %s viewports", async (_mode, metrics) => {
    const { unmount } = render(<GameCanvas />);
    await screen.findByLabelText("可触摸操作的当前谜题棋盘");
    const stack = screen.getByLabelText("棋盘控制区");
    const actions = stack.querySelector<HTMLElement>(".solo-board-actions")!;
    const difficultyRow = screen.getByRole("group", { name: "选择难度" });
    const sizeRow = screen.getByRole("group", { name: "选择棋盘尺寸" });
    const layout = deriveControlStackLayout(520, metrics);
    const defineRect = (node: HTMLElement, top: number, height: number) => Object.defineProperty(node, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }),
    });

    defineRect(actions, layout.actionTop, metrics.actionRowHeight);
    defineRect(difficultyRow, layout.difficultyTop, metrics.pickerRowHeight);
    defineRect(sizeRow, layout.sizeTop, metrics.pickerRowHeight);
    const actionRect = actions.getBoundingClientRect();
    const difficultyRect = difficultyRow.getBoundingClientRect();
    const sizeRect = sizeRow.getBoundingClientRect();

    expect(stack.contains(actions)).toBe(true);
    expect(stack.contains(difficultyRow)).toBe(true);
    expect(stack.contains(sizeRow)).toBe(true);
    expect(difficultyRect.top - actionRect.bottom).toBe(metrics.gap);
    expect(sizeRect.top - difficultyRect.bottom).toBe(metrics.gap);
    unmount();
  });

  it("mints and saves a seed continuation only after a random category is exhausted", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const terminalLevel = shuffleLaunchCatalog(FOREST_LEVELS, () => 0).find((level) => level.gridSize === "6x6" && level.difficulty === "easy")!;
    const group = FOREST_LEVELS.filter((level) => level.gridSize === terminalLevel.gridSize && level.difficulty === terminalLevel.difficulty);
    window.localStorage.setItem("forest-trail-web-2400-progress-v1", JSON.stringify(Object.fromEntries(group.filter((level) => level.id !== terminalLevel.id).map((level) => [level.id, Date.now()]))));
    const { unmount } = render(<GameCanvas />);
    await waitFor(() => expect(screen.getByLabelText("当前谜题状态").textContent).toContain("简单 6x6"));
    fireEvent.click(await screen.findByRole("button", { name: "生成新谜题" }));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("forest-trail-web-2400-continuations-v1") ?? "{}")[`${terminalLevel.gridSize}:${terminalLevel.difficulty}`]).toHaveLength(1));
    unmount();
    randomSpy.mockRestore();
  });
});

describe("first-visit onboarding", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    launchCatalogMock.mockResolvedValue(FOREST_LEVELS);
  });

  afterEach(() => cleanup());

  it("shows three concise highlighted steps and records completion after starting", async () => {
    const { unmount } = render(<GameCanvas />);
    expect(await screen.findByRole("dialog", { name: "新手引导" })).toBeTruthy();
    expect(screen.getByText("从1号路标出发")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByText("沿上下左右连线")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByText("需要时撤回或清空")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "开始游玩" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "新手引导" })).toBeNull());
    expect(window.localStorage.getItem("forest-trail-onboarding-seen-v1")).toBe("1");
    unmount();
  });

  it("can be skipped and does not reappear after the local record is set", async () => {
    const first = render(<GameCanvas />);
    fireEvent.click(await screen.findByRole("button", { name: "跳过引导" }));
    expect(window.localStorage.getItem("forest-trail-onboarding-seen-v1")).toBe("1");
    first.unmount();
    render(<GameCanvas />);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "新手引导" })).toBeNull());
  });
});
