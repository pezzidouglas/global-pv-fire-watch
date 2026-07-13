#!/usr/bin/env node

import { readFile, rename, writeFile } from "node:fs/promises";

const OUTPUT = new URL("../data/candidates.json", import.meta.url);
const TEMP_OUTPUT = new URL("../data/candidates.json.tmp", import.meta.url);
const RUN_STATUS = new URL("../data/.pipeline-news-status.json", import.meta.url);
const INCIDENTS = new URL("../data/incidents.json", import.meta.url);
const INDEXED = new URL("../data/indexed-reports.json", import.meta.url);
const LOOKBACK_DAYS = 21;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const MAX_FEED_BYTES = 2_000_000;
const MAX_ITEMS_PER_QUERY = 200;

const queries = [
  { query: '"solar panel" fire OR blaze', locale: ["en-US", "US", "US:en"] },
  { query: '"solar farm" fire -battery', locale: ["en-US", "US", "US:en"] },
  { query: "photovoltaic fire rooftop warehouse", locale: ["en-US", "US", "US:en"] },
  { query: "incendio paneles solares fotovoltaicos", locale: ["es", "ES", "ES:es"] },
  { query: "incendie panneaux photovoltaïques toiture", locale: ["fr", "FR", "FR:fr"] },
  { query: "Brand Photovoltaikanlage Solarmodule Dach", locale: ["de", "DE", "DE:de"] },
  { query: "incendio fotovoltaico pannelli solari tetto", locale: ["it", "IT", "IT:it"] },
  { query: "incêndio painéis solares fotovoltaico", locale: ["pt-BR", "BR", "BR:pt-419"] },
  { query: "brand zonnepanelen dak", locale: ["nl", "NL", "NL:nl"] },
];

const negativeTerms = /wildfire risk|fire rating|fire safety guide|training|webinar|battery storage|bess|recall|simulation/i;
const positiveTerms = /fire|blaze|burn|incend|brand|feuer|fogo|chamas|flammes/i;
const pvTerms = /solar|photovolta|fotovolta|solarmodul|zonnepanelen|painéis solares/i;

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value) {
  return decodeXml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extract(xml, tag) {
  const expression = new RegExp("<" + tag + "(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</" + tag + ">", "i");
  const match = xml.match(expression);
  return match ? decodeXml(match[1].trim()) : "";
}

function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, MAX_ITEMS_PER_QUERY).flatMap((match) => {
    const body = match[1];
    const published = new Date(extract(body, "pubDate"));
    const title = stripTags(extract(body, "title")).replace(/\s+-\s+[^-]+$/, "");
    const sourceUrl = extract(body, "link").trim();
    if (!title || !sourceUrl || Number.isNaN(published.getTime())) return [];
    return [{
      title,
      summary: stripTags(extract(body, "description")),
      sourceUrl,
      publishedAt: published.toISOString(),
      sourceTitle: stripTags(extract(body, "source")) || "Google News discovery",
    }];
  });
}

function fingerprint(title) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 2)
    .sort()
    .join(" ");
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return "";
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
}

async function readTextWithLimit(response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("xml") && !contentType.includes("rss")) throw new Error("Discovery returned an unexpected content type");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FEED_BYTES) throw new Error("Discovery feed exceeded 2 MB");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new Error("Discovery feed exceeded 2 MB");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "global-pv-fire-watch/1.1 (+open-source research)" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error("Discovery request failed: " + response.status);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastError;
}

async function fetchQuery({ query, locale: [hl, gl, ceid] }) {
  const terms = query + " when:" + LOOKBACK_DAYS + "d";
  const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(terms)
    + "&hl=" + encodeURIComponent(hl)
    + "&gl=" + encodeURIComponent(gl)
    + "&ceid=" + encodeURIComponent(ceid);
  return parseItems(await readTextWithLimit(await fetchWithRetry(url)));
}

const [existingText, incidentsText, indexedText] = await Promise.all([
  readFile(OUTPUT, "utf8").catch(() => "[]"),
  readFile(INCIDENTS, "utf8"),
  readFile(INDEXED, "utf8").catch(() => "[]"),
]);

const existing = JSON.parse(existingText);
const incidents = JSON.parse(incidentsText);
const indexed = JSON.parse(indexedText);
const knownFingerprints = new Set([
  ...existing.map((item) => item.fingerprint || fingerprint(item.title)),
  ...incidents.map((item) => fingerprint(item.title)),
  ...indexed.map((item) => fingerprint(item.title)),
]);
const knownUrls = new Set([
  ...existing.map((item) => canonicalUrl(item.sourceUrl)),
  ...incidents.map((item) => canonicalUrl(item.sourceUrl)),
  ...indexed.map((item) => canonicalUrl(item.sourceUrl)),
]);

const discovered = [];
const failures = [];
let successfulQueries = 0;

for (const query of queries) {
  try {
    const items = await fetchQuery(query);
    successfulQueries += 1;
    for (const item of items) {
      const key = fingerprint(item.title);
      const urlKey = canonicalUrl(item.sourceUrl);
      const searchable = item.title + " " + item.summary;
      if (
        !key
        || !urlKey
        || knownFingerprints.has(key)
        || knownUrls.has(urlKey)
        || negativeTerms.test(searchable)
        || !positiveTerms.test(searchable)
        || !pvTerms.test(searchable)
      ) continue;
      knownFingerprints.add(key);
      knownUrls.add(urlKey);
      discovered.push({
        id: "candidate-" + key.replace(/\s+/g, "-").slice(0, 72),
        fingerprint: key,
        title: item.title,
        publishedAt: item.publishedAt,
        discoveredAt: new Date().toISOString(),
        sourceTitle: item.sourceTitle,
        sourceUrl: item.sourceUrl,
        reviewStatus: "pending",
        discoveryQuery: query.query,
      });
    }
  } catch (error) {
    failures.push({ query: query.query, message: error instanceof Error ? error.message : String(error) });
  }
}

if (successfulQueries === 0) {
  throw new Error("All multilingual discovery queries failed; previous candidate data was preserved.");
}

const merged = [...existing, ...discovered]
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

await writeFile(TEMP_OUTPUT, JSON.stringify(merged, null, 2) + "\n");
await rename(TEMP_OUTPUT, OUTPUT);
await writeFile(RUN_STATUS, JSON.stringify({
  attemptedQueries: queries.length,
  successfulQueries,
  failedQueries: failures.length,
  failures,
  lookbackDays: LOOKBACK_DAYS,
  discoveredCount: discovered.length,
  candidateCount: merged.filter((item) => item.reviewStatus === "pending").length,
}, null, 2) + "\n");

console.log(
  "PV Fire Watch: " + discovered.length + " new candidates; "
  + successfulQueries + "/" + queries.length + " discovery queries succeeded."
);
