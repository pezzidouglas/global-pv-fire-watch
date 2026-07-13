#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const INDEX_OUTPUT = new URL("../data/indexed-reports.json", import.meta.url);
const INDEX_TEMP = new URL("../data/indexed-reports.json.tmp", import.meta.url);
const PIPELINE_STATUS = new URL("../data/pipeline-status.json", import.meta.url);
const NEWS_STATUS = new URL("../data/.pipeline-news-status.json", import.meta.url);
const input = process.argv[2] ?? "https://www.arcbox.solar/solar-fires/";
const checkedAt = new Date().toISOString();
const checkedDate = checkedAt.slice(0, 10);
const MAX_SOURCE_BYTES = 2_000_000;
const MAX_SOURCE_BLOCKS = 500;

async function readTextWithLimit(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) throw new Error("Public index payload exceeded 2 MB");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("Public index payload exceeded 2 MB");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchInput() {
  if (!/^https?:\/\//.test(input)) return readFile(resolve(input), "utf8");
  const response = await fetch(input, {
    headers: { "user-agent": "global-pv-fire-watch/1.1 (+open-source research)" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error("Public index fetch failed: " + response.status);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("Public index returned an unexpected content type: " + contentType);
  return readTextWithLimit(response);
}

const raw = await fetchInput();
if (!raw.includes("preview-box") || !raw.includes("vlp-link")) {
  throw new Error("Public index markup was not recognized; previous data was preserved.");
}

const splitParts = raw.split(/(?=<div class="elementor-element [^"]*preview-box )/g);
const parts = raw.trimStart().startsWith('<div class="elementor-element ')
  ? raw.trimStart().split(/(?=<div class="elementor-element [^"]*preview-box )/g)
  : splitParts.slice(1);
if (parts.length > MAX_SOURCE_BLOCKS) throw new Error("Public index exceeded the 500-record parsing limit");
const countryNames = {
  uk: "United Kingdom", usa: "United States", germany: "Germany", france: "France",
  italy: "Italy", spain: "Spain", netherlands: "Netherlands", panama: "Panama",
  australia: "Australia", austria: "Austria", belgium: "Belgium", canada: "Canada",
  switzerland: "Switzerland", ireland: "Ireland", denmark: "Denmark", sweden: "Sweden",
  norway: "Norway", poland: "Poland", portugal: "Portugal", colombia: "Colombia",
};
const inferredCountries = ["Panama", "Australia", "Colombia", "Portugal", "Gibraltar"];
const exclude = /risk|safety|warning|warns|network|guide|research|study|increase in uk|fire service tackles solar fire every two days|causent-ils|most of fire risk|miliband|launch|facts replace fiction|residential buildings account|how dangerous|wie gefährlich|launched|no los provocaron|not caused by|puerto de gandia|pourquoi certaines centrales/i;
const incidentLanguage = /fire|blaze|burn|flame|smok|incend|brand|feu|brann|fogo|chamas|em chamas|brennen/i;

const stripTags = (value) => value
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replaceAll("&amp;", "&")
  .replaceAll("&#039;", "'")
  .replaceAll("&quot;", '"')
  .replaceAll("&nbsp;", " ")
  .replace(/\s+/g, " ")
  .trim();

const match = (text, expression) => text.match(expression)?.[1] ?? "";
const slug = (value) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
const isPrivateHost = (hostname) => {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local") || value.endsWith(".internal")) return true;
  if (value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168) || parts[0] >= 224;
};
const normalizeUrl = (value) => {
  try {
    if (!value || value.length > 2048) return "";
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || isPrivateHost(url.hostname)) return "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.hostname === "dailymail.com") url.hostname = "dailymail.co.uk";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|app-referrer$)/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/%20+$/i, "").replace(/\/+$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return "";
  }
};

const [reviewed, previousRecords, previousStatus, newsStatus] = await Promise.all([
  readFile(new URL("../data/incidents.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(INDEX_OUTPUT, "utf8").then(JSON.parse).catch(() => []),
  readFile(PIPELINE_STATUS, "utf8").then(JSON.parse).catch(() => null),
  readFile(NEWS_STATUS, "utf8").then(JSON.parse).catch(() => ({
    attemptedQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    failures: [],
    lookbackDays: 0,
    discoveredCount: 0,
    candidateCount: 0,
  })),
]);

const seenUrls = new Set();
const seenIds = new Set();
const reviewedSources = new Set(reviewed.map((item) => normalizeUrl(item.sourceUrl)).filter(Boolean));
const records = [];

for (const part of parts) {
  const classText = match(part, /<div class="([^"]*preview-box [^"]*)"/);
  const classes = classText.split(/\s+/);
  const year = classes.find((value) => /^20\d\d$/.test(value));
  const month = classes.find((value) => /^m\d\d$/.test(value))?.slice(1);
  const sourceUrl = normalizeUrl(stripTags(match(part, /<a href="([^"]+)" class="vlp-link"/)));
  const title = stripTags(match(part, /<div class="vlp-block-0 vlp-link-title">([\s\S]*?)<\/div>/)).slice(0, 220);
  const upstreamSummary = stripTags(match(part, /<div class="vlp-block-1 vlp-link-summary">([\s\S]*?)<\/div>/)).slice(0, 2000);
  const assetType = classes.includes("utility") ? "utility" : classes.includes("commercial") || classes.includes("residential") ? "rooftop" : null;
  const countryCode = Object.keys(countryNames).find((name) => classes.includes(name));
  const inferred = inferredCountries.find((name) => new RegExp(name + "\\s+\\d{2}\\/20\\d{2}", "i").test(upstreamSummary));
  let country = countryCode ? countryNames[countryCode] : inferred ?? null;
  const hostname = sourceUrl ? new URL(sourceUrl).hostname.toLowerCase() : "";
  if (hostname.endsWith(".com.au") || hostname.endsWith(".net.au") || hostname.endsWith(".org.au")) country = "Australia";
  if (hostname.endsWith(".at")) country = "Austria";
  if (!year || !month || !sourceUrl || !title || !upstreamSummary || !assetType || !country) continue;
  if (exclude.test(title) || !incidentLanguage.test(title + " " + upstreamSummary) || seenUrls.has(sourceUrl) || reviewedSources.has(sourceUrl)) continue;
  const id = "index-" + year + "-" + month + "-" + slug(title);
  if (seenIds.has(id)) continue;
  seenUrls.add(sourceUrl);
  seenIds.add(id);
  const propertyType = classes.includes("residential") ? "Residential" : classes.includes("commercial") ? "Commercial / institutional" : "Utility-scale";
  records.push({
    id,
    date: year + "-" + month + "-01",
    datePrecision: "month",
    title,
    country,
    assetType,
    propertyType,
    status: "source-indexed",
    pvRole: "reported-involvement",
    summary: `Public reporting places a PV-related fire at a ${propertyType.toLowerCase()} site in ${country}. Date is recorded to month precision; PV ignition has not been independently confirmed.`,
    sourceTitle: "Original public report",
    sourceUrl,
    indexedBy: "ArcBox vendor-curated public incident index",
    indexedAt: checkedDate,
  });
}

records.sort((a, b) => b.date.localeCompare(a.date) || a.country.localeCompare(b.country));
const minimumSafeCount = Math.max(25, Math.floor(previousRecords.length * 0.9));
if (records.length < minimumSafeCount) {
  throw new Error(
    "Public index parsed " + records.length + " records; safety threshold is "
    + minimumSafeCount + ". Previous data was preserved."
  );
}

const contentProjection = (items) => items.map((item) => Object.fromEntries(
  Object.entries(item).filter(([key]) => key !== "indexedAt")
));
const previousContent = JSON.stringify(contentProjection(previousRecords));
const nextContent = JSON.stringify(contentProjection(records));
const contentChanged = previousContent !== nextContent;
const checksum = createHash("sha256").update(nextContent).digest("hex");

await writeFile(INDEX_TEMP, JSON.stringify(records, null, 2) + "\n");
await rename(INDEX_TEMP, INDEX_OUTPUT);

const overallStatus = newsStatus.failedQueries > 0 ? "degraded" : "healthy";
const pipelineStatus = {
  schemaVersion: 2,
  cadence: "daily",
  overallStatus,
  lastAttemptAt: checkedAt,
  lastSuccessfulCheckAt: checkedAt,
  lastValidatedSnapshotAt: checkedAt,
  lastContentChangeAt: contentChanged ? checkedAt : previousStatus?.lastContentChangeAt ?? checkedAt,
  sources: [
    {
      id: "multilingual-news",
      label: "Multilingual news discovery",
      status: newsStatus.failedQueries > 0 ? "degraded" : "healthy",
      attemptedQueries: newsStatus.attemptedQueries,
      successfulQueries: newsStatus.successfulQueries,
      failedQueries: newsStatus.failedQueries,
      lookbackDays: newsStatus.lookbackDays,
      recordCount: newsStatus.candidateCount,
    },
    {
      id: "public-report-index",
      label: "Public incident index",
      status: "healthy",
      recordCount: records.length,
      checksum,
    },
  ],
};

await writeFile(PIPELINE_STATUS, JSON.stringify(pipelineStatus, null, 2) + "\n");
await unlink(NEWS_STATUS).catch(() => {});
console.log("Imported " + records.length + " source-indexed incident reports; pipeline status " + overallStatus + ".");
