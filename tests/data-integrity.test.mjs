import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (name) => JSON.parse(
  await readFile(new URL("../data/" + name, import.meta.url), "utf8")
);

function assertUniqueIds(rows, layer) {
  const ids = rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, layer + " contains duplicate IDs");
}

function assertPublicUrl(value, label) {
  const parsed = new URL(value);
  assert.ok(["http:", "https:"].includes(parsed.protocol), label + " must use HTTP(S)");
}

test("incident and index records satisfy the publication schema", async () => {
  const [incidents, indexed, groups] = await Promise.all([
    readJson("incidents.json"),
    readJson("indexed-reports.json"),
    readJson("event-groups.json"),
  ]);

  assert.ok(incidents.length >= 45, "reviewed incident dataset unexpectedly shrank");
  assert.ok(indexed.length >= 80, "public index unexpectedly shrank");
  assertUniqueIds(incidents, "reviewed incidents");
  assertUniqueIds(indexed, "indexed reports");

  const allowedAssets = new Set(["rooftop", "utility"]);
  const allowedEvidence = new Set(["verified", "reported", "under-review"]);
  const allowedPvRoles = new Set(["confirmed", "suspected", "involved", "external"]);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  for (const incident of incidents) {
    assert.ok(incident.title && incident.city && incident.country, incident.id + " is missing location/title data");
    assert.ok(allowedAssets.has(incident.assetType), incident.id + " has an invalid asset type");
    assert.ok(allowedEvidence.has(incident.status), incident.id + " has an invalid evidence status");
    assert.ok(allowedPvRoles.has(incident.pvRole), incident.id + " has an invalid PV role");
    assert.ok(Number.isFinite(incident.lat) && incident.lat >= -90 && incident.lat <= 90, incident.id + " has invalid latitude");
    assert.ok(Number.isFinite(incident.lng) && incident.lng >= -180 && incident.lng <= 180, incident.id + " has invalid longitude");
    assert.ok(new Date(incident.date + "T00:00:00Z") < tomorrow, incident.id + " is dated in the future");
    assertPublicUrl(incident.sourceUrl, incident.id);
    assert.equal(incident.locationPrecision, "approximate-city-or-site", incident.id + " must disclose map precision");
  }

  for (const report of indexed) {
    assert.ok(report.title && report.country && report.summary, report.id + " is missing report data");
    assert.ok(allowedAssets.has(report.assetType), report.id + " has an invalid asset type");
    assert.equal(report.status, "source-indexed");
    assert.equal(report.pvRole, "reported-involvement");
    assert.match(report.date, /^\d{4}-\d{2}-01$/, report.id + " must retain month precision");
    assertPublicUrl(report.sourceUrl, report.id);
    assert.match(report.summary, /^Public reporting places a PV-related fire at a /, report.id + " must use project-authored summary copy");
    assert.equal(report.indexedBy, "ArcBox vendor-curated public incident index");
  }

  assert.ok(!indexed.some((item) => groups.excludedRecords[item.id]), "excluded records must not be published");
  assert.equal(indexed.find((item) => item.id === "index-2026-06-photovoltaikanlage-auf-industriedach-stand-in-flammen")?.country, "Austria");

  const cutoff = new Date("2016-07-12T00:00:00Z");
  const activeReviewed = incidents.filter((item) => new Date(item.date + "T00:00:00Z") >= cutoff);
  const activeIndexed = indexed.filter((item) => new Date(item.date + "T00:00:00Z") >= cutoff);
  const eventIds = new Set([...activeReviewed, ...activeIndexed].map((item) => groups.recordToEvent[item.id] ?? item.id));
  const collapsedRecordCount = activeReviewed.length + activeIndexed.length - eventIds.size;

  assert.ok(activeReviewed.length >= 47, "active reviewed dataset unexpectedly shrank");
  assert.ok(activeIndexed.length >= 122, "active public index unexpectedly shrank");
  assert.equal(
    collapsedRecordCount,
    23,
    "known event-link collapse count changed; audit event links before publishing",
  );
});

test("pipeline metadata and automation describe a real daily scan", async () => {
  const [status, workflow, importer] = await Promise.all([
    readJson("pipeline-status.json"),
    readFile(new URL("../.github/workflows/update-incidents.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/import-public-index.mjs", import.meta.url), "utf8"),
  ]);

  assert.equal(status.cadence, "daily");
  assert.ok(["healthy", "degraded"].includes(status.overallStatus));
  assert.ok(!Number.isNaN(Date.parse(status.lastSuccessfulCheckAt)));
  assert.match(workflow, /cron:\s*"17 14 \* \* \*"/);
  assert.match(workflow, /data\/pipeline-status\.json/);
  assert.doesNotMatch(importer, /indexedAt:\s*"2026-/);
  assert.match(importer, /minimumSafeCount/);
  assert.match(importer, /previousRecords\.length \* 0\.9/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /pull-requests: write/);
  assert.match(workflow, /gh pr create/);
  assert.doesNotMatch(workflow, /git push\s*$/m, "automation must not push directly to the checked-out branch");
});
