import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runDailyCheck } from "./dailyFeed";

/**
 * Heartbeat cron callback — POST /api/scheduled/daily-refresh
 *
 * Triggered daily by the Manus platform. Runs the live public-index check,
 * persists the result to the daily_checks table, and warms the in-memory
 * cache so visitor requests to /api/daily-feed are served instantly with
 * a fresh, dated status even on serverless cold starts.
 */
export async function dailyRefreshHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }

    const payload = await runDailyCheck();
    res.json({
      ok: true,
      overallStatus: payload.overallStatus,
      sourceMode: payload.sourceMode,
      degradedReason: payload.degradedReason,
      reportCount: payload.indexedReports.length,
      checkedAt: payload.lastAttemptAt,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "unknown-error",
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}
