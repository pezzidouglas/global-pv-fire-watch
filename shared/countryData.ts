/**
 * Country-level selectors for dedicated country detail pages and the
 * "What's new" diff panel. Pure functions over the shared dataset so both
 * client pages and server tests can consume them.
 */
import type { PublicIndexReport } from "./public-index";
import {
  eventGroups,
  indexedReports,
  researchSources,
  reviewedIncidents,
  type ResearchSource,
  type ReviewedIncident,
} from "./pvFireWatchData";

export function countrySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Maps research-source jurisdiction labels to a canonical country name (or null for multi-country benchmarks). */
export function jurisdictionCountry(jurisdiction: string): string | null {
  const j = jurisdiction.toLowerCase();
  if (j.includes("international") || j.includes("global")) return null;
  if (j.includes("amazon")) return "United States";
  if (j === "england" || j.includes("united kingdom")) return "United Kingdom";
  if (j.includes("australia")) return "Australia";
  if (j.includes("germany")) return "Germany";
  if (j.includes("italy")) return "Italy";
  if (j.includes("japan")) return "Japan";
  if (j.includes("netherlands")) return "Netherlands";
  if (j.includes("slovenia")) return "Slovenia";
  if (j.includes("united states")) return "United States";
  if (j.includes("austria")) return "Austria";
  if (j.includes("denmark")) return "Denmark";
  if (j.includes("sweden")) return "Sweden";
  if (j.includes("poland")) return "Poland";
  if (j.includes("czech")) return "Czechia";
  if (j.includes("korea")) return "South Korea";
  if (j.includes("new zealand")) return "New Zealand";
  if (j.includes("france")) return "France";
  if (j.includes("taiwan")) return "Taiwan";
  return jurisdiction;
}

export type CountryDetail = {
  country: string;
  slug: string;
  reviewed: ReviewedIncident[];
  indexed: PublicIndexReport[];
  research: ResearchSource[];
  internationalBenchmarks: ResearchSource[];
  events: number;
  totalRecords: number;
};

/** Every country that has at least one reviewed incident or indexed report. */
export function listCountries(): Array<{ country: string; slug: string; reviewed: number; indexed: number; events: number }> {
  const map = new Map<string, { reviewed: number; indexed: number; eventIds: Set<string> }>();
  const eventId = (id: string) => eventGroups.recordToEvent[id] ?? id;
  const bump = (country: string, layer: "reviewed" | "indexed", id: string) => {
    const entry = map.get(country) ?? { reviewed: 0, indexed: 0, eventIds: new Set<string>() };
    entry[layer] += 1;
    entry.eventIds.add(eventId(id));
    map.set(country, entry);
  };
  reviewedIncidents.forEach((item) => bump(item.country, "reviewed", item.id));
  indexedReports.forEach((item) => {
    if (!eventGroups.excludedRecords[item.id]) bump(item.country, "indexed", item.id);
  });
  return Array.from(map.entries())
    .map(([country, entry]) => ({
      country,
      slug: countrySlug(country),
      reviewed: entry.reviewed,
      indexed: entry.indexed,
      events: entry.eventIds.size,
    }))
    .sort((a, b) => b.events - a.events || a.country.localeCompare(b.country));
}

/** Full data selection for a single country page; null when the slug is unknown. */
export function getCountryDetail(slug: string): CountryDetail | null {
  const entry = listCountries().find((item) => item.slug === slug);
  if (!entry) return null;
  const eventId = (id: string) => eventGroups.recordToEvent[id] ?? id;
  const reviewed = reviewedIncidents
    .filter((item) => item.country === entry.country)
    .sort((a, b) => b.date.localeCompare(a.date));
  const indexed = indexedReports
    .filter((item) => item.country === entry.country && !eventGroups.excludedRecords[item.id])
    .sort((a, b) => b.date.localeCompare(a.date));
  const research = researchSources.filter(
    (source) => jurisdictionCountry(source.jurisdiction) === entry.country,
  );
  const internationalBenchmarks = researchSources.filter(
    (source) => jurisdictionCountry(source.jurisdiction) === null,
  );
  const events = new Set([...reviewed.map((i) => eventId(i.id)), ...indexed.map((i) => eventId(i.id))]).size;
  return {
    country: entry.country,
    slug: entry.slug,
    reviewed,
    indexed,
    research,
    internationalBenchmarks,
    events,
    totalRecords: reviewed.length + indexed.length,
  };
}

/**
 * Diff a live indexed-report list against the validated snapshot.
 * Returns reports whose ids are not present in the snapshot — the basis
 * for the dashboard "What's new" panel.
 */
export function diffNewReports<T extends { id: string }>(live: T[], snapshot: Array<{ id: string }>): T[] {
  const known = new Set(snapshot.map((item) => item.id));
  return live.filter((item) => !known.has(item.id));
}
