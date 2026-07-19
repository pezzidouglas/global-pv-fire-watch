#!/usr/bin/env node

import { readFile, unlink, writeFile } from "node:fs/promises";

const INDEXED = new URL("../data/indexed-reports.json", import.meta.url);
const PIPELINE_STATUS = new URL("../data/pipeline-status.json", import.meta.url);
const NEWS_STATUS = new URL("../data/.pipeline-news-status.json", import.meta.url);
const checkedAt = new Date().toISOString();
const errorLog = process.argv[2];

const [previousRecords, previousStatus, newsStatus, failureText] = await Promise.all([
  readFile(INDEXED, "utf8").then(JSON.parse),
  readFile(PIPELINE_STATUS, "utf8").then(JSON.parse).catch(() => null),
  readFile(NEWS_STATUS, "utf8").then(JSON.parse).catch(() => ({
    attemptedQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    failures: [],
    lookbackDays: 0,
    candidateCount: 0,
  })),
  errorLog ? readFile(errorLog, "utf8").catch(() => "") : "",
]);

if (!Array.isArray(previousRecords) || previousRecords.length < 80) {
  throw new Error("Cannot retain an unavailable public index without a previously validated safe snapshot");
}

const failureMessage = failureText.match(/^Error:\s*(.+)$/m)?.[1]?.slice(0, 300)
  ?? "Public index refresh failed; the previous validated snapshot was retained.";
const previousPublicSource = previousStatus?.sources?.find((source) => source.id === "public-report-index") ?? {};
const previousSuccessfulCheck = previousStatus?.lastSuccessfulCheckAt
  ?? previousStatus?.lastValidatedSnapshotAt
  ?? checkedAt;
const newsDegraded = newsStatus.failedQueries > 0;

const pipelineStatus = {
  schemaVersion: 2,
  cadence: "daily",
  overallStatus: "degraded",
  lastAttemptAt: checkedAt,
  lastSuccessfulCheckAt: previousSuccessfulCheck,
  lastValidatedSnapshotAt: checkedAt,
  lastContentChangeAt: previousStatus?.lastContentChangeAt ?? previousSuccessfulCheck,
  sources: [
    {
      id: "multilingual-news",
      label: "Multilingual news discovery",
      status: newsDegraded ? "degraded" : "healthy",
      attemptedQueries: newsStatus.attemptedQueries,
      successfulQueries: newsStatus.successfulQueries,
      failedQueries: newsStatus.failedQueries,
      lookbackDays: newsStatus.lookbackDays,
      recordCount: newsStatus.candidateCount,
    },
    {
      ...previousPublicSource,
      id: "public-report-index",
      label: "Public incident index",
      status: "degraded",
      recordCount: previousRecords.length,
      lastError: failureMessage,
    },
  ],
};

await writeFile(PIPELINE_STATUS, JSON.stringify(pipelineStatus, null, 2) + "\n");
await unlink(NEWS_STATUS).catch(() => {});
console.warn(
  `Public incident index unavailable (${failureMessage}); retained ${previousRecords.length} validated records and marked the source degraded.`,
);
