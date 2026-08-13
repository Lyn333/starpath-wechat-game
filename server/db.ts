import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { type Difficulty, type GridSize, type LevelSnapshot, type LevelStatus, type ValidationResult, hideSolution } from "../shared/levelSchema";
import { InsertUser, levelPublications, levels, levelVersions, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function requireDb<T>(db: T | null): T {
  if (!db) throw new Error("数据库当前不可用，请稍后重试。");
  return db;
}

export type LevelWriteInput = {
  title: string;
  slug: string;
  gridSize: GridSize;
  difficulty: Difficulty;
  snapshot: LevelSnapshot;
  validation: ValidationResult;
};

export async function listAdminLevels(filters: { status?: LevelStatus; gridSize?: GridSize; difficulty?: Difficulty }) {
  const db = requireDb(await getDb());
  const conditions = [filters.status ? eq(levels.status, filters.status) : undefined, filters.gridSize ? eq(levels.gridSize, filters.gridSize) : undefined, filters.difficulty ? eq(levels.difficulty, filters.difficulty) : undefined].filter(Boolean);
  return db.select().from(levels).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(levels.updatedAt));
}

export async function getLevelDetail(levelId: string) {
  const db = requireDb(await getDb());
  const level = (await db.select().from(levels).where(eq(levels.id, levelId)).limit(1))[0];
  if (!level) return null;
  const versions = await db.select().from(levelVersions).where(eq(levelVersions.levelId, levelId)).orderBy(desc(levelVersions.versionNumber));
  const publications = await db.select().from(levelPublications).where(eq(levelPublications.levelId, levelId)).orderBy(desc(levelPublications.createdAt));
  return { level, versions, publications };
}

export async function createLevel(input: LevelWriteInput, createdBy: number) {
  const db = requireDb(await getDb());
  const levelId = nanoid(16);
  const versionId = nanoid(16);
  await db.transaction(async (tx) => {
    await tx.insert(levels).values({ id: levelId, slug: input.slug, title: input.title, gridSize: input.gridSize, difficulty: input.difficulty, status: input.validation.valid ? "validated" : "draft", createdBy });
    await tx.insert(levelVersions).values({ id: versionId, levelId, versionNumber: 1, snapshot: input.snapshot, validation: input.validation, createdBy });
  });
  return { levelId, versionId };
}

export async function saveDraftVersion(levelId: string, input: Omit<LevelWriteInput, "slug">, createdBy: number) {
  const db = requireDb(await getDb());
  const existing = (await db.select({ id: levels.id, slug: levels.slug }).from(levels).where(eq(levels.id, levelId)).limit(1))[0];
  if (!existing) throw new Error("关卡不存在。");
  const countRow = (await db.select({ count: sql<number>`count(*)` }).from(levelVersions).where(eq(levelVersions.levelId, levelId)))[0];
  const versionId = nanoid(16);
  const versionNumber = Number(countRow?.count ?? 0) + 1;
  await db.transaction(async (tx) => {
    await tx.insert(levelVersions).values({ id: versionId, levelId, versionNumber, snapshot: input.snapshot, validation: input.validation, createdBy });
    await tx.update(levels).set({ title: input.title, gridSize: input.gridSize, difficulty: input.difficulty, status: input.validation.valid ? "validated" : "draft", archivedAt: null }).where(eq(levels.id, levelId));
  });
  return { levelId, versionId, versionNumber };
}

export async function publishLevelVersion(levelId: string, versionId: string, createdBy: number, action: "publish" | "rollback" = "publish") {
  const db = requireDb(await getDb());
  const version = (await db.select().from(levelVersions).where(and(eq(levelVersions.id, versionId), eq(levelVersions.levelId, levelId))).limit(1))[0];
  if (!version) throw new Error("目标版本不存在。");
  if (!version.validation.valid) throw new Error("只有通过校验的版本可以发布。");
  await db.transaction(async (tx) => {
    await tx.update(levels).set({ status: "published", publishedVersionId: versionId, archivedAt: null }).where(eq(levels.id, levelId));
    await tx.insert(levelPublications).values({ id: nanoid(16), levelId, versionId, action, createdBy });
  });
  return { levelId, versionId, action };
}

export async function archiveLevel(levelId: string, createdBy: number) {
  const db = requireDb(await getDb());
  await db.transaction(async (tx) => {
    await tx.update(levels).set({ status: "archived", archivedAt: new Date() }).where(eq(levels.id, levelId));
    await tx.insert(levelPublications).values({ id: nanoid(16), levelId, versionId: null, action: "archive", createdBy });
  });
  return { levelId };
}

export async function listPublishedLevels(filters: { gridSize?: GridSize; difficulty?: Difficulty }) {
  const db = requireDb(await getDb());
  const conditions = [eq(levels.status, "published"), filters.gridSize ? eq(levels.gridSize, filters.gridSize) : undefined, filters.difficulty ? eq(levels.difficulty, filters.difficulty) : undefined].filter(Boolean);
  const rows = await db.select({ id: levels.id, slug: levels.slug, title: levels.title, gridSize: levels.gridSize, difficulty: levels.difficulty, versionId: levelVersions.id, versionNumber: levelVersions.versionNumber, snapshot: levelVersions.snapshot }).from(levels).innerJoin(levelVersions, eq(levels.publishedVersionId, levelVersions.id)).where(and(...conditions)).orderBy(desc(levels.updatedAt));
  return rows.map((row) => ({ ...row, snapshot: hideSolution(row.snapshot) }));
}
