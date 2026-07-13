import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

/**
 * Persists the result of the scheduled daily public-index check so the
 * daily-feed API can serve a warm, dated status even after serverless
 * cold starts. One row per check; latest row wins.
 */
export const dailyChecks = mysqlTable("daily_checks", {
  id: int("id").autoincrement().primaryKey(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
  overallStatus: varchar("overallStatus", { length: 32 }).notNull(),
  sourceMode: varchar("sourceMode", { length: 64 }).notNull(),
  degradedReason: varchar("degradedReason", { length: 128 }),
  reportCount: int("reportCount").default(0).notNull(),
  payloadJson: text("payloadJson").notNull(),
});

export type DailyCheck = typeof dailyChecks.$inferSelect;