import type { Express, Request, Response } from "express";
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

const SAFE_SHRINK_RATIO = 0.9;
const CACHE_TTL_MS = 60 * 60 * 1000; // re-check the live source at most hourly per instance

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
};

let cached: { payload: FeedPayload; at: number } | null = null;

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
    };
  } catch (error) {
    return snapshotPayload(attemptedAt, safeReason(error));
  }
}

export function registerDailyFeedRoute(app: Express) {
  app.get("/api/daily-feed", async (_req: Request, res: Response) => {
    if (cached && Date.now() - cached.at < CACHE_TTL_MS && cached.payload.overallStatus === "healthy") {
      res.setHeader("cache-control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=1800");
      res.setHeader("x-content-type-options", "nosniff");
      res.json(cached.payload);
      return;
    }
    const payload = await buildDailyFeedPayload();
    if (payload.overallStatus === "healthy") {
      cached = { payload, at: Date.now() };
      res.setHeader("cache-control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=1800");
    } else {
      res.setHeader("cache-control", "public, max-age=0, s-maxage=900, stale-while-revalidate=900");
    }
    res.setHeader("x-content-type-options", "nosniff");
    res.json(payload);
  });
}
