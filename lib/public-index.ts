export type PublicIndexReport = {
  id: string;
  date: string;
  datePrecision: "month";
  title: string;
  country: string;
  assetType: "rooftop" | "utility";
  propertyType: string;
  status: "source-indexed";
  pvRole: "reported-involvement";
  summary: string;
  sourceTitle: string;
  sourceUrl: string;
  indexedBy: string;
  indexedAt: string;
};

export const PUBLIC_INDEX_URL = "https://www.arcbox.solar/solar-fires/";
export const MAX_SOURCE_BYTES = 2_000_000;
export const MAX_SOURCE_BLOCKS = 500;
export const MAX_REPORTS = 500;
export const MAX_TITLE_LENGTH = 220;

const countryNames: Record<string, string> = {
  uk: "United Kingdom", usa: "United States", germany: "Germany", france: "France",
  italy: "Italy", spain: "Spain", netherlands: "Netherlands", panama: "Panama",
  australia: "Australia", austria: "Austria", belgium: "Belgium", canada: "Canada",
  switzerland: "Switzerland", ireland: "Ireland", denmark: "Denmark", sweden: "Sweden",
  norway: "Norway", poland: "Poland", portugal: "Portugal", colombia: "Colombia",
};

const inferredCountries = ["Panama", "Australia", "Colombia", "Portugal", "Gibraltar"];
const excludedHeadlines = /risk|safety|warning|warns|network|guide|research|study|increase in uk|fire service tackles solar fire every two days|causent-ils|most of fire risk|miliband|launch|facts replace fiction|residential buildings account|how dangerous|wie gefährlich|launched|no los provocaron|not caused by|puerto de gandia|pourquoi certaines centrales/i;
const incidentLanguage = /fire|blaze|burn|flame|smok|incend|brand|feu|brann|fogo|chamas|em chamas|brennen/i;
const batteryOnlyLanguage = /\b(?:battery storage|bess|battery container|lithium(?:-ion)? batter)/i;
const pvLanguage = /\b(?:solar|photovolta|fotovolta|solarmodul|zonnepanelen|panneaux solaires|pain[eé]is solares)/i;

const stripTags = (value: string) => value
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replaceAll("&amp;", "&")
  .replaceAll("&#039;", "'")
  .replaceAll("&quot;", '"')
  .replaceAll("&nbsp;", " ")
  .replace(/\s+/g, " ")
  .trim();

const match = (text: string, expression: RegExp) => text.match(expression)?.[1] ?? "";
const slug = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);

function isPrivateHost(hostname: string) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local") || value.endsWith(".internal")) return true;
  if (value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 0
    || parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] >= 224;
}

export function normalizePublicHttpUrl(value: string) {
  try {
    if (!value || value.length > 2_048) return "";
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
}

export async function readTextWithLimit(response: Response, limit = MAX_SOURCE_BYTES) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) throw new Error("payload-too-large");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      throw new Error("payload-too-large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function projectAuthoredSummary(country: string, propertyType: string) {
  return `Public reporting places a PV-related fire at a ${propertyType.toLowerCase()} site in ${country}. Date is recorded to month precision; PV ignition has not been independently confirmed.`;
}

export function parsePublicIndex(raw: string, checkedDate: string, reviewedSourceUrls: Iterable<string> = []) {
  if (!raw.includes("preview-box") || !raw.includes("vlp-link")) throw new Error("markup-not-recognized");
  const reviewedSources = new Set([...reviewedSourceUrls].map(normalizePublicHttpUrl).filter(Boolean));
  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();
  const records: PublicIndexReport[] = [];
  const splitParts = raw.split(/(?=<div class="elementor-element [^"]*preview-box )/g);
  const parts = raw.trimStart().startsWith('<div class="elementor-element ')
    ? raw.trimStart().split(/(?=<div class="elementor-element [^"]*preview-box )/g)
    : splitParts.slice(1);
  if (parts.length > MAX_SOURCE_BLOCKS) throw new Error("record-limit-exceeded");

  for (const part of parts) {
    const classes = match(part, /<div class="([^"]*preview-box [^"]*)"/).split(/\s+/);
    const year = classes.find((value) => /^20\d\d$/.test(value));
    const month = classes.find((value) => /^m\d\d$/.test(value))?.slice(1);
    const sourceUrl = normalizePublicHttpUrl(stripTags(match(part, /<a href="([^"]+)" class="vlp-link"/)));
    const rawTitle = stripTags(match(part, /<div class="vlp-block-0 vlp-link-title">([\s\S]*?)<\/div>/));
    const title = rawTitle.slice(0, MAX_TITLE_LENGTH);
    const upstreamSummary = stripTags(match(part, /<div class="vlp-block-1 vlp-link-summary">([\s\S]*?)<\/div>/)).slice(0, 2_000);
    const assetType = classes.includes("utility")
      ? "utility"
      : classes.includes("commercial") || classes.includes("residential") ? "rooftop" : null;
    const countryCode = Object.keys(countryNames).find((name) => classes.includes(name));
    const inferred = inferredCountries.find((name) => new RegExp(name + "\\s+\\d{2}\\/20\\d{2}", "i").test(upstreamSummary));
    let country = countryCode ? countryNames[countryCode] : inferred ?? null;
    const hostname = sourceUrl ? new URL(sourceUrl).hostname.toLowerCase() : "";
    if (hostname.endsWith(".com.au") || hostname.endsWith(".net.au") || hostname.endsWith(".org.au")) country = "Australia";
    if (hostname.endsWith(".at")) country = "Austria";
    if (!year || !month || !sourceUrl || !title || !upstreamSummary || !assetType || !country) continue;
    const searchable = `${title} ${upstreamSummary}`;
    if (
      excludedHeadlines.test(title)
      || !incidentLanguage.test(searchable)
      || (batteryOnlyLanguage.test(searchable) && !pvLanguage.test(searchable))
      || seenUrls.has(sourceUrl)
      || reviewedSources.has(sourceUrl)
    ) continue;
    const id = `index-${year}-${month}-${slug(title)}`;
    if (seenIds.has(id)) continue;
    seenUrls.add(sourceUrl);
    seenIds.add(id);
    const propertyType = classes.includes("residential")
      ? "Residential"
      : classes.includes("commercial") ? "Commercial / institutional" : "Utility-scale";
    records.push({
      id,
      date: `${year}-${month}-01`,
      datePrecision: "month",
      title,
      country,
      assetType,
      propertyType,
      status: "source-indexed",
      pvRole: "reported-involvement",
      summary: projectAuthoredSummary(country, propertyType),
      sourceTitle: "Original public report",
      sourceUrl,
      indexedBy: "ArcBox vendor-curated public incident index",
      indexedAt: checkedDate,
    });
    if (records.length > MAX_REPORTS) throw new Error("record-limit-exceeded");
  }

  return records.sort((a, b) => b.date.localeCompare(a.date) || a.country.localeCompare(b.country));
}

export function stableReportContent(reports: PublicIndexReport[]) {
  return JSON.stringify([...reports]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((report) => {
      const projection: Partial<PublicIndexReport> = { ...report };
      delete projection.indexedAt;
      return projection;
    }));
}
