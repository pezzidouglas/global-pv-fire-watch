import fallbackCandidates from "@/data/candidates.json";
import fallbackReports from "@/data/indexed-reports.json";
import reviewedIncidents from "@/data/incidents.json";
import pipelineStatus from "@/data/pipeline-status.json";
import {
  PUBLIC_INDEX_URL,
  parsePublicIndex,
  readTextWithLimit,
  stableReportContent,
  type PublicIndexReport,
} from "@/lib/public-index";

const SAFE_SHRINK_RATIO = 0.9;

function safeReason(error: unknown) {
  const message = error instanceof Error ? error.message : "source-unavailable";
  if (message.includes("payload-too-large")) return "payload-too-large";
  if (message.includes("record-limit")) return "record-limit-exceeded";
  if (message.includes("content-type")) return "unexpected-content-type";
  if (message.includes("source-shrink")) return "source-shrink-quarantined";
  if (message.includes("markup") || message.includes("validation")) return "validation-failed";
  return "source-unavailable";
}

function snapshotPayload(attemptedAt: string, reason: string) {
  return {
    overallStatus: "degraded" as const,
    lastAttemptAt: attemptedAt,
    lastSuccessfulCheckAt: pipelineStatus.lastSuccessfulCheckAt,
    lastValidatedSnapshotAt: pipelineStatus.lastValidatedSnapshotAt,
    lastContentChangeAt: pipelineStatus.lastContentChangeAt,
    contentDiffersFromSnapshot: false,
    indexedReports: fallbackReports,
    pendingCandidateCount: fallbackCandidates.filter((item) => item.reviewStatus === "pending").length,
    sourceMode: "validated-snapshot" as const,
    degradedReason: reason,
  };
}

export async function GET() {
  const attemptedAt = new Date().toISOString();
  try {
    const response = await fetch(PUBLIC_INDEX_URL, {
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
      reviewedIncidents.map((item) => item.sourceUrl),
    );
    const minimumSafeCount = Math.max(25, Math.floor(fallbackReports.length * SAFE_SHRINK_RATIO));
    if (reports.length < minimumSafeCount) throw new Error("source-shrink-quarantined");
    const contentDiffersFromSnapshot = stableReportContent(reports) !== stableReportContent(fallbackReports as PublicIndexReport[]);

    return Response.json({
      overallStatus: "healthy",
      lastAttemptAt: attemptedAt,
      lastSuccessfulCheckAt: attemptedAt,
      lastValidatedSnapshotAt: pipelineStatus.lastValidatedSnapshotAt,
      lastContentChangeAt: pipelineStatus.lastContentChangeAt,
      contentDiffersFromSnapshot,
      indexedReports: reports,
      pendingCandidateCount: fallbackCandidates.filter((item) => item.reviewStatus === "pending").length,
      sourceMode: "daily-live-check",
      degradedReason: null,
    }, {
      headers: {
        "cache-control": "public, max-age=0, s-maxage=82800, stale-while-revalidate=1800",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(snapshotPayload(attemptedAt, safeReason(error)), {
      headers: {
        "cache-control": "public, max-age=0, s-maxage=900, stale-while-revalidate=900",
        "x-content-type-options": "nosniff",
      },
    });
  }
}
