import { and, eq, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { levels, users } from "../../drizzle/schema";
import { makeStarterSnapshot } from "../../shared/levelEditorOps";
import { validateLevelSnapshot } from "../../shared/levelSchema";
import { archiveLevel, createLevel, getDb, getLevelDetail, listPublishedLevels, publishLevelVersion, saveDraftVersion } from "../db";

const databaseIt = process.env.RUN_DB_INTEGRATION === "1" ? it : it.skip;

describe("level management database integration", () => {
  databaseIt("creates, publishes, rolls back and archives an authorized temporary level", async () => {
    const db = await getDb();
    if (!db) throw new Error("数据库当前不可用，无法执行真实关卡验证。");
    const administrator = (await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1))[0];
    if (!administrator) throw new Error("未找到管理员用户，无法执行真实关卡验证。");

    const interruptedRuns = await db.select({ id: levels.id }).from(levels).where(like(levels.slug, "verification-trail-%"));
    for (const run of interruptedRuns) await archiveLevel(run.id, administrator.id);

    const slug = `verification-trail-${Date.now()}`;
    const snapshot = makeStarterSnapshot("6x6");
    const validation = validateLevelSnapshot("6x6", snapshot);
    expect(validation.valid).toBe(true);
    const baseInput = { title: "临时验证林地", gridSize: "6x6" as const, difficulty: "medium" as const, snapshot, validation };

    const firstDraft = await createLevel({ ...baseInput, slug }, administrator.id);
    const secondDraft = await saveDraftVersion(firstDraft.levelId, { ...baseInput, title: "临时验证林地 · v2" }, administrator.id);

    await publishLevelVersion(firstDraft.levelId, secondDraft.versionId, administrator.id);
    let detail = await getLevelDetail(firstDraft.levelId);
    expect(detail?.level.status).toBe("published");
    expect(detail?.level.publishedVersionId).toBe(secondDraft.versionId);
    expect(detail?.publications.some((item) => item.action === "publish" && item.versionId === secondDraft.versionId)).toBe(true);

    await publishLevelVersion(firstDraft.levelId, firstDraft.versionId, administrator.id, "rollback");
    detail = await getLevelDetail(firstDraft.levelId);
    expect(detail?.level.publishedVersionId).toBe(firstDraft.versionId);
    expect(detail?.publications.some((item) => item.action === "rollback" && item.versionId === firstDraft.versionId)).toBe(true);

    await archiveLevel(firstDraft.levelId, administrator.id);
    detail = await getLevelDetail(firstDraft.levelId);
    expect(detail?.level.status).toBe("archived");
    expect(detail?.publications.some((item) => item.action === "archive")).toBe(true);
    const archivedRow = (await db.select({ status: levels.status }).from(levels).where(and(eq(levels.id, firstDraft.levelId), eq(levels.status, "archived"))).limit(1))[0];
    expect(archivedRow?.status).toBe("archived");
    expect((await listPublishedLevels({})).some((item) => item.slug === slug)).toBe(false);
  }, 30_000);
});
