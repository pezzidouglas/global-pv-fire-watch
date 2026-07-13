#!/usr/bin/env node

import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(process.argv[2] ?? "incoming");
const allowed = new Set(["candidates.json", "indexed-reports.json", "pipeline-status.json"]);
const names = await readdir(directory);
if (names.length !== allowed.size || names.some((name) => !allowed.has(name))) {
  throw new Error("Snapshot artifact contains an unexpected file set");
}

for (const name of names) {
  if (!(await lstat(resolve(directory, name))).isFile()) throw new Error(`${name} is not a regular file`);
}

const [candidates, reports, status] = await Promise.all([
  readFile(resolve(directory, "candidates.json"), "utf8").then(JSON.parse),
  readFile(resolve(directory, "indexed-reports.json"), "utf8").then(JSON.parse),
  readFile(resolve(directory, "pipeline-status.json"), "utf8").then(JSON.parse),
]);

if (!Array.isArray(candidates) || !Array.isArray(reports)) throw new Error("Snapshot arrays are invalid");
if (reports.length < 80 || reports.length > 500) throw new Error("Indexed report count is outside the safe range");
if (new Set(reports.map((item) => item.id)).size !== reports.length) throw new Error("Indexed report IDs are not unique");
if (reports.some((item) => !item.id || !item.title || !item.sourceUrl || !["http:", "https:"].includes(new URL(item.sourceUrl).protocol))) {
  throw new Error("Indexed report schema or URL validation failed");
}
if (status?.cadence !== "daily" || Number.isNaN(Date.parse(status.lastSuccessfulCheckAt))) {
  throw new Error("Pipeline status is invalid");
}

console.log(`Validated ${reports.length} indexed reports and ${candidates.length} candidates.`);
