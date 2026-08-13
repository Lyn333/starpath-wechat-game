import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const dbMocks = vi.hoisted(() => ({
  archiveLevel: vi.fn(),
  createLevel: vi.fn(),
  getLevelDetail: vi.fn(),
  listAdminLevels: vi.fn(),
  listPublishedLevels: vi.fn(),
  publishLevelVersion: vi.fn(),
  saveDraftVersion: vi.fn(),
}));

vi.mock("../db", () => dbMocks);

import { appRouter } from "../routers";

function snakeSnapshot() {
  const solution = Array.from({ length: 36 }, (_, index) => {
    const row = Math.floor(index / 6);
    const offset = index % 6;
    return { row, col: row % 2 ? 5 - offset : offset };
  });
  return {
    rows: 6,
    cols: 6,
    solution,
    walls: [],
    waypoints: [
      { number: 1, cell: solution[0] },
      { number: 2, cell: solution[12] },
      { number: 3, cell: solution[35] },
    ],
  };
}

function context(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 17,
      openId: "level-editor-test-user",
      name: "Level Editor",
      email: "editor@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("levelAdmin router", () => {
  it("returns immediate validation for a legal 6x6 route", async () => {
    const caller = appRouter.createCaller(context("admin"));
    const result = await caller.levelAdmin.validate({ gridSize: "6x6", snapshot: snakeSnapshot() });
    expect(result.valid).toBe(true);
    expect(result.summary.coveredCells).toBe(36);
  });

  it("rejects non-admin callers before reaching a management procedure", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.levelAdmin.list()).rejects.toMatchObject({ message: NOT_ADMIN_ERR_MSG });
    expect(dbMocks.listAdminLevels).not.toHaveBeenCalled();
  });

  it("persists a valid draft through the typed create procedure", async () => {
    dbMocks.createLevel.mockResolvedValueOnce({ levelId: "level-1", versionId: "version-1" });
    const caller = appRouter.createCaller(context("admin"));
    const snapshot = snakeSnapshot();
    await expect(caller.levelAdmin.create({ title: "苔影林地 · 01", slug: "moss-grove-01", gridSize: "6x6", difficulty: "medium", snapshot })).resolves.toEqual({ levelId: "level-1", versionId: "version-1" });
    expect(dbMocks.createLevel).toHaveBeenCalledWith(expect.objectContaining({ title: "苔影林地 · 01", validation: expect.objectContaining({ valid: true }) }), 17);
  });

  it("publishes a selected valid version and sends the manager identity to the persistence layer", async () => {
    dbMocks.publishLevelVersion.mockResolvedValueOnce({ levelId: "level-1", versionId: "version-2", action: "publish" });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.levelAdmin.publish({ levelId: "level-1", versionId: "version-2" })).resolves.toMatchObject({ action: "publish" });
    expect(dbMocks.publishLevelVersion).toHaveBeenCalledWith("level-1", "version-2", 17);
  });

  it("surfaces a rejected version during publication instead of changing current state", async () => {
    dbMocks.publishLevelVersion.mockRejectedValueOnce(new Error("只有通过校验的版本可以发布。"));
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.levelAdmin.publish({ levelId: "level-1", versionId: "invalid-version" })).rejects.toThrow("只有通过校验的版本可以发布。");
  });

  it("reuses publication storage with rollback action and archives a level through separate audit flow", async () => {
    dbMocks.publishLevelVersion.mockResolvedValueOnce({ levelId: "level-1", versionId: "version-1", action: "rollback" });
    dbMocks.archiveLevel.mockResolvedValueOnce({ levelId: "level-1" });
    const caller = appRouter.createCaller(context("admin"));
    await caller.levelAdmin.rollback({ levelId: "level-1", versionId: "version-1" });
    await caller.levelAdmin.archive({ levelId: "level-1" });
    expect(dbMocks.publishLevelVersion).toHaveBeenLastCalledWith("level-1", "version-1", 17, "rollback");
    expect(dbMocks.archiveLevel).toHaveBeenLastCalledWith("level-1", 17);
  });
});
