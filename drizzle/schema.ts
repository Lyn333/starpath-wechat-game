import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import type { LevelSnapshot, ValidationResult } from "../shared/levelSchema";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const levels = mysqlTable("levels", {
  id: varchar("id", { length: 32 }).primaryKey(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  title: varchar("title", { length: 160 }).notNull(),
  gridSize: mysqlEnum("gridSize", ["6x6", "8x8", "10x10", "12x12"]).notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull(),
  status: mysqlEnum("status", ["draft", "validated", "published", "archived"]).default("draft").notNull(),
  publishedVersionId: varchar("publishedVersionId", { length: 32 }),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
}, (table) => [index("levels_status_idx").on(table.status), index("levels_size_difficulty_idx").on(table.gridSize, table.difficulty)]);

export const levelVersions = mysqlTable("level_versions", {
  id: varchar("id", { length: 32 }).primaryKey(),
  levelId: varchar("levelId", { length: 32 }).notNull().references(() => levels.id, { onDelete: "cascade" }),
  versionNumber: int("versionNumber").notNull(),
  snapshot: json("snapshot").$type<LevelSnapshot>().notNull(),
  validation: json("validation").$type<ValidationResult>().notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("level_versions_level_idx").on(table.levelId), index("level_versions_level_number_idx").on(table.levelId, table.versionNumber)]);

export const levelPublications = mysqlTable("level_publications", {
  id: varchar("id", { length: 32 }).primaryKey(),
  levelId: varchar("levelId", { length: 32 }).notNull().references(() => levels.id, { onDelete: "cascade" }),
  versionId: varchar("versionId", { length: 32 }).references(() => levelVersions.id, { onDelete: "set null" }),
  action: mysqlEnum("action", ["publish", "rollback", "archive"]).notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("level_publications_level_idx").on(table.levelId)]);
