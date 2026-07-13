/**
 * Shared typed data module for Global PV Fire Watch.
 * Centralizes the validated dataset exports so pages and server routes
 * consume one typed surface instead of casting raw JSON at each usage site.
 */
import candidatesJson from "./data/candidates.json";
import eventGroupsJson from "./data/event-groups.json";
import incidentsJson from "./data/incidents.json";
import indexedReportsJson from "./data/indexed-reports.json";
import pipelineStatusJson from "./data/pipeline-status.json";
import researchSourcesJson from "./data/research-sources.json";
import type { PublicIndexReport } from "./public-index";

export type ReviewedIncident = {
  id: string;
  date: string;
  datePrecision?: "day" | "month" | "year";
  title: string;
  city: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  assetType: "rooftop" | "utility";
  propertyType: string;
  severity: "minor" | "moderate" | "major" | "catastrophic";
  status: string;
  pvRole: string;
  causeCategory: string;
  cause: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceType: string;
  summary: string;
  injuries?: number;
  lossUsd?: number | null;
  locationPrecision?: string;
};

export type Candidate = {
  id: string;
  fingerprint: string;
  title: string;
  publishedAt: string;
  discoveredAt: string;
  sourceTitle: string;
  sourceUrl: string;
  reviewStatus: "pending" | "accepted" | "rejected";
  discoveryQuery: string;
};

export type ResearchSource = {
  id?: string;
  jurisdiction: string;
  period: string;
  count: number | null;
  confirmedPvOrigin: number | null;
  metric: string;
  sourceClass: string;
  sourceTitle: string;
  sourceUrl: string;
  windowRelation: string;
  caveat: string;
  yearly?: Record<string, number> | null;
};

export type PipelineStatus = {
  schemaVersion: number;
  cadence: string;
  overallStatus: string;
  lastAttemptAt: string;
  lastSuccessfulCheckAt: string;
  lastContentChangeAt: string;
  lastValidatedSnapshotAt: string;
  sources: Array<Record<string, unknown>>;
};

export type EventGroups = {
  methodologyVersion: string;
  recordToEvent: Record<string, string>;
  excludedRecords: Record<string, string>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[pvFireWatchData] validation failed: ${message}`);
}

function validateIncidents(raw: unknown): ReviewedIncident[] {
  assert(Array.isArray(raw) && raw.length > 0, "incidents must be a non-empty array");
  for (const item of raw as ReviewedIncident[]) {
    assert(typeof item.id === "string" && item.id, `incident id missing`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(item.date), `incident ${item.id} has invalid date`);
    assert(typeof item.lat === "number" && typeof item.lng === "number", `incident ${item.id} missing coordinates`);
    assert(typeof item.country === "string" && item.country.length > 1, `incident ${item.id} missing country`);
    assert(item.assetType === "rooftop" || item.assetType === "utility", `incident ${item.id} invalid assetType`);
  }
  return raw as ReviewedIncident[];
}

function validateIndexedReports(raw: unknown): PublicIndexReport[] {
  assert(Array.isArray(raw) && raw.length > 0, "indexed reports must be a non-empty array");
  for (const item of raw as PublicIndexReport[]) {
    assert(typeof item.id === "string" && item.id.startsWith("index-"), `indexed report id invalid`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(item.date), `indexed report ${item.id} has invalid date`);
    assert(typeof item.sourceUrl === "string" && item.sourceUrl.startsWith("http"), `indexed report ${item.id} bad url`);
  }
  return raw as PublicIndexReport[];
}

export const reviewedIncidents: ReviewedIncident[] = validateIncidents(incidentsJson);
export const indexedReports: PublicIndexReport[] = validateIndexedReports(indexedReportsJson);
export const candidates: Candidate[] = candidatesJson as Candidate[];
export const researchSources: ResearchSource[] = researchSourcesJson as unknown as ResearchSource[];
export const pipelineStatus: PipelineStatus = pipelineStatusJson as PipelineStatus;
export const eventGroups: EventGroups = eventGroupsJson as EventGroups;

export const pendingCandidateCount = candidates.filter((item) => item.reviewStatus === "pending").length;
