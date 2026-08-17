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
const MAX_ITEMS_PER_QUERY = 250;

// Regional queries intentionally use local-language fire and PV terms. These are
// discovery leads only: nothing reaches the reviewed register without human review.
const googleQueries = [
  { id: "global-en", region: "Global", query: '"solar panel" fire OR blaze', locale: ["en-US", "US", "US:en"] },
  { id: "us-solar-farm", region: "United States", query: '"solar farm" fire -battery', locale: ["en-US", "US", "US:en"] },
  { id: "us-rooftop", region: "United States", query: "photovoltaic fire rooftop warehouse", locale: ["en-US", "US", "US:en"] },
  { id: "insurance-loss", region: "Global", query: '("solar panel" OR photovoltaic) fire insurance OR insurer OR loss', locale: ["en-GB", "GB", "GB:en"] },
  { id: "spain", region: "Spain", query: "incendio paneles solares fotovoltaicos", locale: ["es", "ES", "ES:es"] },
  { id: "latin-america", region: "Latin America", query: "incendio paneles solares fotovoltaicos", locale: ["es-419", "MX", "MX:es-419"] },
  { id: "france", region: "France", query: "incendie panneaux photovoltaïques toiture", locale: ["fr", "FR", "FR:fr"] },
  { id: "germany", region: "Germany", query: "Brand Photovoltaikanlage Solarmodule Dach", locale: ["de", "DE", "DE:de"] },
  { id: "italy", region: "Italy", query: "incendio fotovoltaico pannelli solari tetto", locale: ["it", "IT", "IT:it"] },
  { id: "brazil", region: "Brazil", query: "incêndio painéis solares fotovoltaico", locale: ["pt-BR", "BR", "BR:pt-419"] },
  { id: "netherlands", region: "Netherlands", query: "brand zonnepanelen dak", locale: ["nl", "NL", "NL:nl"] },
  { id: "poland", region: "Poland", query: "pożar paneli fotowoltaicznych dach", locale: ["pl", "PL", "PL:pl"] },
  { id: "nordics", region: "Nordics", query: "brand solceller tak OR solcelleanlegg brann", locale: ["sv", "SE", "SE:sv"] },
  { id: "turkey", region: "Türkiye", query: "güneş paneli yangın çatı", locale: ["tr", "TR", "TR:tr"] },
  { id: "japan", region: "Japan", query: "太陽光パネル 火災 屋根", locale: ["ja", "JP", "JP:ja"] },
  { id: "south-korea", region: "South Korea", query: "태양광 패널 화재 지붕", locale: ["ko", "KR", "KR:ko"] },
  { id: "china", region: "China", query: "光伏 屋顶 火灾", locale: ["zh-CN", "CN", "CN:zh-Hans"] },
  { id: "taiwan", region: "Taiwan", query: "太陽能板 火災 屋頂", locale: ["zh-TW", "TW", "TW:zh-Hant"] },
  { id: "india-hi", region: "India", query: "सोलर पैनल आग छत", locale: ["hi", "IN", "IN:hi"] },
  { id: "india-en", region: "India", query: '"solar panel" fire rooftop', locale: ["en-IN", "IN", "IN:en"] },
  { id: "indonesia", region: "Indonesia", query: "kebakaran panel surya atap", locale: ["id", "ID", "ID:id"] },
  { id: "malaysia", region: "Malaysia", query: "kebakaran panel solar bumbung", locale: ["ms", "MY", "MY:ms"] },
  { id: "thailand", region: "Thailand", query: "ไฟไหม้ แผงโซลาร์เซลล์ หลังคา", locale: ["th", "TH", "TH:th"] },
  { id: "vietnam", region: "Vietnam", query: "cháy pin năng lượng mặt trời mái nhà", locale: ["vi", "VN", "VN:vi"] },
  { id: "philippines", region: "Philippines", query: '"solar panel" fire roof', locale: ["en-PH", "PH", "PH:en"] },
  { id: "gulf-ar", region: "Middle East", query: "حريق ألواح شمسية سطح", locale: ["ar", "AE", "AE:ar"] },
  { id: "israel", region: "Israel", query: "שריפה פאנלים סולאריים גג", locale: ["he", "IL", "IL:he"] },
];

const gdeltQueries = [
  { id: "gdelt-global-en", region: "Global", query: '("solar panel" OR photovoltaic) (fire OR blaze)' },
  { id: "gdelt-europe", region: "Europe", query: '(fotovoltaico OR photovoltaïque OR Photovoltaikanlage OR zonnepanelen) (incendio OR incendie OR Brand)' },
  { id: "gdelt-east-asia", region: "East Asia", query: '(solar OR photovoltaic) (fire OR blaze) (sourcecountry:japan OR sourcecountry:china OR sourcecountry:southkorea)' },
  { id: "gdelt-south-asia", region: "South and Southeast Asia", query: '("solar panel" OR "panel surya" OR "pin năng lượng mặt trời") (fire OR आग OR kebakaran OR cháy)' },
];

const negativeTerms = /wildfire risk|fire rating|fire safety guide|training|webinar|battery storage|bess|recall|simulation|山火风险|储能电池|배터리 저장|बैटरी भंडारण/i;
const positiveTerms = /fire|blaze|burn|incend|brand|feuer|fogo|chamas|flammes|pożar|yangın|火災|火灾|화재|आग|kebakaran|ไฟไหม้|cháy|حريق|שריפה/i;
const pvTerms = /solar|photovolta|fotovolta|solarmodul|zonnepanelen|painéis solares|solceller|güneş paneli|太陽光|太陽能|光伏|태양광|सोलर|panel surya|panel solar|โซลาร์|năng lượng mặt trời|ألواح شمسية|סולאר/i;

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

function parseGdeltDate(value) {
  if (!/^\d{8}T\d{6}Z$/.test(value ?? "")) return null;
  const formatted = value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z");
  const parsed = new Date(formatted);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseGdelt(payload) {
  const articles = Array.isArray(payload?.articles) ? payload.articles : [];
  return articles.slice(0, MAX_ITEMS_PER_QUERY).flatMap((article) => {
    const published = parseGdeltDate(article.seendate);
    const sourceUrl = typeof article.url === "string" ? article.url : "";
    const title = typeof article.title === "string" ? article.title.trim() : "";
    if (!published || !sourceUrl || !title) return [];
    return [{
      title,
      summary: "",
      sourceUrl,
      publishedAt: published.toISOString(),
      sourceTitle: typeof article.domain === "string" ? article.domain : "GDELT source",
      sourceLanguage: typeof article.language === "string" ? article.language : null,
      sourceCountry: typeof article.sourcecountry === "string" ? article.sourcecountry : null,
    }];
  });
}

function fingerprint(title) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 1)
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

async function readBodyWithLimit(response, allowedTypes) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!allowedTypes.some((type) => contentType.includes(type))) throw new Error("Discovery returned an unexpected content type");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FEED_BYTES) throw new Error("Discovery feed exceeded 2 MB");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new Error("Discovery feed exceeded 2 MB");
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "global-pv-fire-watch/2.0 (+open-source research)" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error("Discovery request failed: " + response.status);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function fetchGoogleQuery({ query, locale: [hl, gl, ceid] }) {
  const terms = query + " when:" + LOOKBACK_DAYS + "d";
  const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(terms)
    + "&hl=" + encodeURIComponent(hl)
    + "&gl=" + encodeURIComponent(gl)
    + "&ceid=" + encodeURIComponent(ceid);
  const response = await fetchWithRetry(url);
  return parseItems(await readBodyWithLimit(response, ["xml", "rss"]));
}

async function fetchGdeltQuery({ query }) {
  const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=" + encodeURIComponent(query)
    + "&mode=ArtList&maxrecords=" + MAX_ITEMS_PER_QUERY
    + "&format=json&timespan=" + LOOKBACK_DAYS + "d&sort=DateDesc";
  const response = await fetchWithRetry(url);
  const body = await readBodyWithLimit(response, ["json", "text/plain"]);
  return parseGdelt(JSON.parse(body));
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

function acceptItems(items, query, provider) {
  let count = 0;
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
    count += 1;
    discovered.push({
      id: "candidate-" + key.replace(/\s+/g, "-").slice(0, 72),
      fingerprint: key,
      title: item.title,
      publishedAt: item.publishedAt,
      discoveredAt: new Date().toISOString(),
      sourceTitle: item.sourceTitle,
      sourceUrl: item.sourceUrl,
      reviewStatus: "pending",
      discoveryProvider: provider,
      discoveryRegion: query.region,
      discoveryQuery: query.query,
      ...(item.sourceLanguage ? { sourceLanguage: item.sourceLanguage } : {}),
      ...(item.sourceCountry ? { sourceCountry: item.sourceCountry } : {}),
    });
  }
  return count;
}

async function runProvider(id, label, queries, fetchQuery, options = {}) {
  const failures = [];
  let successfulQueries = 0;
  let discoveredCount = 0;
  const results = options.sequential
    ? []
    : await Promise.allSettled(queries.map((query) => fetchQuery(query)));
  if (options.sequential) {
    for (const query of queries) {
      try {
        results.push({ status: "fulfilled", value: await fetchQuery(query) });
      } catch (reason) {
        results.push({ status: "rejected", reason });
      }
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }
  results.forEach((result, index) => {
    const query = queries[index];
    if (result.status === "fulfilled") {
      successfulQueries += 1;
      discoveredCount += acceptItems(result.value, query, id);
    } else {
      failures.push({ id: query.id, region: query.region, query: query.query, message: result.reason instanceof Error ? result.reason.message : String(result.reason) });
    }
  });
  return {
    id,
    label,
    attemptedQueries: queries.length,
    successfulQueries,
    failedQueries: failures.length,
    failures,
    discoveredCount,
    status: successfulQueries === 0 ? "failed" : failures.length > 0 ? "degraded" : "healthy",
  };
}

const providers = [];
providers.push(await runProvider("google-news", "Google News RSS", googleQueries, fetchGoogleQuery));
// GDELT applies request-rate limits; serialize its small number of regional lanes.
providers.push(await runProvider("gdelt-doc", "GDELT DOC 2.1", gdeltQueries, fetchGdeltQuery, { sequential: true, delayMs: 6_000 }));

const successfulQueries = providers.reduce((sum, provider) => sum + provider.successfulQueries, 0);
const attemptedQueries = providers.reduce((sum, provider) => sum + provider.attemptedQueries, 0);
if (successfulQueries === 0) throw new Error("All multilingual discovery providers failed; previous candidate data was preserved.");

const merged = [...existing, ...discovered].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

await writeFile(TEMP_OUTPUT, JSON.stringify(merged, null, 2) + "\n");
await rename(TEMP_OUTPUT, OUTPUT);
await writeFile(RUN_STATUS, JSON.stringify({
  providers,
  attemptedQueries,
  successfulQueries,
  failedQueries: attemptedQueries - successfulQueries,
  lookbackDays: LOOKBACK_DAYS,
  discoveredCount: discovered.length,
  candidateCount: merged.filter((item) => item.reviewStatus === "pending").length,
}, null, 2) + "\n");

console.log(
  "PV Fire Watch: " + discovered.length + " new candidates; "
  + successfulQueries + "/" + attemptedQueries + " queries succeeded across " + providers.length + " providers."
);
