import assert from "node:assert/strict";
import test from "node:test";
import { escapeCsvCell } from "../lib/csv.ts";
import {
  MAX_SOURCE_BYTES,
  normalizePublicHttpUrl,
  parsePublicIndex,
  readTextWithLimit,
  stableReportContent,
} from "../lib/public-index.ts";

function block({ index = 1, href = `https://news.example/fire-${index}`, title = `Solar panel fire ${index}`, classes = "usa commercial" } = {}) {
  return `<div class="elementor-element preview-box 2026 m06 ${classes}"><a href="${href}" class="vlp-link"><div class="vlp-block-0 vlp-link-title">${title}</div><div class="vlp-block-1 vlp-link-summary">Fire involving a photovoltaic installation USA 06/2026</div></a></div>`;
}

test("public URLs reject executable, credentialed and private destinations", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "https://user:pass@example.com/fire",
    "http://127.0.0.1/fire",
    "http://192.168.1.5/fire",
    "http://[::1]/fire",
  ]) assert.equal(normalizePublicHttpUrl(value), "", value);
  assert.equal(normalizePublicHttpUrl("https://Example.com/fire?utm_source=test#x"), "https://example.com/fire");
});

test("parser publishes bounded project-authored records and fixes Austrian hosts", () => {
  const reports = parsePublicIndex(block({
    href: "https://kleinezeitung.at/fire",
    title: "Photovoltaikanlage auf Industriedach stand in Flammen".repeat(8),
    classes: "germany commercial",
  }), "2026-07-12");
  assert.equal(reports.length, 1);
  assert.equal(reports[0].country, "Austria");
  assert.ok(reports[0].title.length <= 220);
  assert.match(reports[0].summary, /^Public reporting places/);
  assert.doesNotMatch(reports[0].summary, /USA 06\/2026/);
});

test("parser discards unsafe links and known non-incidents", () => {
  const reports = parsePublicIndex([
    block({ href: "javascript:alert(1)" }),
    block({ index: 2, title: "UK Fire Service Tackles Solar Fire Every Two Days" }),
    block({ index: 3, title: "El incendio en una nave del Puerto de Gandia ha sido extinguido", classes: "spain commercial" }),
    block({ index: 4 }),
  ].join(""), "2026-07-12");
  assert.deepEqual(reports.map((item) => item.id), ["index-2026-06-solar-panel-fire-4"]);
});

test("response reader rejects declared and streamed payloads over 2 MB", async () => {
  await assert.rejects(() => readTextWithLimit(new Response("x", { headers: { "content-length": String(MAX_SOURCE_BYTES + 1) } })), /payload-too-large/);
  const chunk = new Uint8Array(MAX_SOURCE_BYTES + 1);
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(chunk); controller.close(); } }));
  await assert.rejects(() => readTextWithLimit(response), /payload-too-large/);
});

test("stable comparison detects same-count content changes", () => {
  const first = parsePublicIndex(block({ index: 1 }), "2026-07-12");
  const second = parsePublicIndex(block({ index: 1, title: "Changed solar panel fire" }), "2026-07-12");
  assert.notEqual(stableReportContent(first), stableReportContent(second));
});

test("CSV cells neutralize spreadsheet formulas", () => {
  for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) {
    assert.ok(escapeCsvCell(`${prefix}SUM(A1)`).startsWith(`"'`));
  }
  assert.equal(escapeCsvCell("ordinary"), '"ordinary"');
});
