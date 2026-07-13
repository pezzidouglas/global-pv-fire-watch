import { desc } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { dailyChecks } from "../drizzle/schema";
import { getDb } from "./db";
import fallbackCandidates from "../shared/data/candidates.json";
import fallbackReports from "../shared/data/indexed-reports.json";
import reviewedIncidents from "../shared/data/incidents.json";
import pipelineStatus from "../shared/data/pipeline-status.json";
import {
  PUBLIC_INDEX_URL,
  parsePublicIndex,
  readTextWithLimit,
  stableReportContent,
  type PublicIndexReport,
} from "../shared/public-index";
import { diffNewReports } from "../shared/countryData";

const SAFE_SHRINK_RATIO = 0.9;
const CACHE_TTL_MS = 60 * 60 * 1000; // re-check the live source at most hourly per instance
const PERSISTED_TTL_MS = 26 * 60 * 60 * 1000; // trust the scheduled daily check for a full day (+2h grace)

type FeedPayload = {
  overallStatus: "healthy" | "degraded" | "failed";
  lastAttemptAt: string;
  lastSuccessfulCheckAt: string;
  lastValidatedSnapshotAt: string;
  lastContentChangeAt: string;
  contentDiffersFromSnapshot: boolean;
  indexedReports: PublicIndexReport[];
  pendingCandidateCount: number;
  sourceMode: "daily-live-check" | "validated-snapshot";
  degradedReason: string | null;
  /** Live-indexed reports not present in the validated snapshot (empty in snapshot mode). */
  newReports: PublicIndexReport[];
};

let cached: { payload: FeedPayload; at: number } | null = null;

/**
 * Legacy persisted checks predate the newReports field; recompute the diff
 * from the persisted report list so the dashboard never shows a false all-clear.
 */
export function normalizePersistedPayload(payload: FeedPayload): FeedPayload {
  if (!Array.isArray(payload.newReports)) {
    payload.newReports =
      payload.sourceMode === "daily-live-check"
        ? diffNewReports(payload.indexedReports ?? [], fallbackReports as PublicIndexReport[])
        : [];
  }
  return payload;
}

/** Persist a check result so status survives serverless cold starts. */
async function persistCheck(payload: FeedPayload): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(dailyChecks).values({
      overallStatus: payload.overallStatus,
      sourceMode: payload.sourceMode,
      degradedReason: payload.degradedReason,
      reportCount: payload.indexedReports.length,
      payloadJson: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("[daily-feed] failed to persist check:", error);
  }
}

/** Load the most recent persisted check, if any and reasonably fresh. */
async function loadLatestCheck(maxAgeMs: number): Promise<FeedPayload | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(dailyChecks).orderBy(desc(dailyChecks.id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    if (Date.now() - new Date(row.checkedAt).getTime() > maxAgeMs) return null;
    return normalizePersistedPayload(JSON.parse(row.payloadJson) as FeedPayload);
  } catch (error) {
    console.warn("[daily-feed] failed to load persisted check:", error);
    return null;
  }
}

/**
 * Run the daily live-source check and persist the result.
 * Used by the scheduled Heartbeat handler and reusable elsewhere.
 */
export async function runDailyCheck(fetchImpl: typeof fetch = fetch): Promise<FeedPayload> {
  const payload = await buildDailyFeedPayload(fetchImpl);
  await persistCheck(payload);
  if (payload.overallStatus === "healthy") {
    cached = { payload, at: Date.now() };
  }
  return payload;
}

export function safeReason(error: unknown) {
  const message = error instanceof Error ? error.message : "source-unavailable";
  if (message.includes("payload-too-large")) return "payload-too-large";
  if (message.includes("record-limit")) return "record-limit-exceeded";
  if (message.includes("content-type")) return "unexpected-content-type";
  if (message.includes("source-shrink")) return "source-shrink-quarantined";
  if (message.includes("markup") || message.includes("validation")) return "validation-failed";
  return "source-unavailable";
}

export function snapshotPayload(attemptedAt: string, reason: string): FeedPayload {
  return {
    overallStatus: "degraded",
    lastAttemptAt: attemptedAt,
    lastSuccessfulCheckAt: pipelineStatus.lastSuccessfulCheckAt,
    lastValidatedSnapshotAt: pipelineStatus.lastValidatedSnapshotAt,
    lastContentChangeAt: pipelineStatus.lastContentChangeAt,
    contentDiffersFromSnapshot: false,
    indexedReports: fallbackReports as PublicIndexReport[],
    pendingCandidateCount: (fallbackCandidates as Array<{ reviewStatus: string }>).filter(
      (item) => item.reviewStatus === "pending",
    ).length,
    sourceMode: "validated-snapshot",
    degradedReason: reason,
    newReports: [],
  };
}

export async function buildDailyFeedPayload(fetchImpl: typeof fetch = fetch): Promise<FeedPayload> {
  const attemptedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(PUBLIC_INDEX_URL, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "global-pv-fire-watch/2.0 (+public-source research)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`source-http-${response.status}`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("unexpected-content-type");
    }

    const reports = parsePublicIndex(
      await readTextWithLimit(response),
      attemptedAt.slice(0, 10),
      (reviewedIncidents as Array<{ sourceUrl: string }>).map((item) => item.sourceUrl),
    );
    const minimumSafeCount = Math.max(25, Math.floor((fallbackReports as unknown[]).length * SAFE_SHRINK_RATIO));
    if (reports.length < minimumSafeCount) throw new Error("source-shrink-quarantined");
    const contentDiffersFromSnapshot =
      stableReportContent(reports) !== stableReportContent(fallbackReports as PublicIndexReport[]);
    const newReports = diffNewReports(reports, fallbackReports as PublicIndexReport[]);

    return {
      overallStatus: "healthy",
      lastAttemptAt: attemptedAt,
      lastSuccessfulCheckAt: attemptedAt,
      lastValidatedSnapshotAt: pipelineStatus.lastValidatedSnapshotAt,
      lastContentChangeAt: pipelineStatus.lastContentChangeAt,
      contentDiffersFromSnapshot,
      indexedReports: reports,
      pendingCandidateCount: (fallbackCandidates as Array<{ reviewStatus: string }>).filter(
        (item) => item.reviewStatus === "pending",
      ).length,
      sourceMode: "daily-live-check",
      degradedReason: null,
      newReports,
    };
  } catch (error) {
    return snapshotPayload(attemptedAt, safeReason(error));
  }
}

export function registerDailyFeedRoute(app: Express) {
  app.get("/api/daily-feed", async (_req: Request, res: Response) => {
    // Dev-only: ?demoNew=N synthesizes N "new" reports so the What's new
    // has-new UI state can be verified deterministically. Never active in production.
    if (process.env.NODE_ENV !== "production" && typeof _req.query.demoNew === "string") {
      const count = Math.min(Math.max(parseInt(_req.query.demoNew, 10) || 0, 0), 12);
      const base = await buildDailyFeedPayload();
      const synthetic = (fallbackReports as PublicIndexReport[]).slice(0, count).map((report, index) => ({
        ...report,
        id: `index-demo-new-${index + 1}`,
        title: `[Demo] ${report.title}`,
      }));
      res.setHeader("cache-control", "no-store");
      res.json({ ...base, sourceMode: "daily-live-check", overallStatus: "healthy", newReports: synthetic });
      return;
    }
    if (cached && Date.now() - cached.at < CACHE_TTL_MS && cached.payload.overallStatus === "healthy") {
      res.setHeader("cache-control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=1800");
      res.setHeader("x-content-type-options", "nosniff");
      res.json(cached.payload);
      return;
    }
    // Warm start from the scheduled daily check persisted in the database,
    // so cold serverless instances serve the cron-refreshed state instantly.
    // Healthy results are trusted for the full daily cadence; degraded results
    // are served briefly while a fresh live re-check happens on the next miss.
    const persisted = await loadLatestCheck(PERSISTED_TTL_MS);
    if (persisted) {
      const persistedAt = new Date(persisted.lastAttemptAt).getTime();
      const isHealthy = persisted.overallStatus === "healthy";
      const degradedStillFresh = !isHealthy && Date.now() - persistedAt < CACHE_TTL_MS;
      if (isHealthy || degradedStillFresh) {
        if (isHealthy) cached = { payload: persisted, at: Date.now() };
        res.setHeader(
          "cache-control",
          isHealthy
            ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=1800"
            : "public, max-age=0, s-maxage=900, stale-while-revalidate=900",
        );
        res.setHeader("x-content-type-options", "nosniff");
        res.json(persisted);
        return;
      }
    }
    const payload = await runDailyCheck();
    if (payload.overallStatus === "healthy") {
      res.setHeader("cache-control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=1800");
    } else {
      res.setHeader("cache-control", "public, max-age=0, s-maxage=900, stale-while-revalidate=900");
    }
    res.setHeader("x-content-type-options", "nosniff");
    res.json(payload);
  });
}
