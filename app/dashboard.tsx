"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoCentroid, geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import { createIncidentCsv } from "@/lib/csv";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Download,
  ExternalLink,
  FileSearch,
  Filter,
  Globe2,
  Info,
  Layers3,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type Incident = {
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
  status: "verified" | "reported" | "under-review";
  pvRole: "confirmed" | "suspected" | "involved" | "external";
  causeCategory: string;
  cause: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceType: string;
  summary: string;
  injuries: number | null;
  lossUsd: number | null;
  locationPrecision: "approximate-city-or-site";
};

type IndexedReport = {
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

type ResearchSource = {
  id: string;
  jurisdiction: string;
  period: string;
  count: number | null;
  confirmedPvOrigin: number | null;
  metric: string;
  sourceClass: string;
  sourceTitle: string;
  sourceUrl: string;
  windowRelation: "within-window" | "overlaps-window" | "historical-benchmark";
  caveat: string;
  yearly: Record<string, number> | null;
};

type PipelineStatus = {
  schemaVersion: number;
  cadence: "daily";
  overallStatus: "healthy" | "degraded" | "failed";
  lastAttemptAt: string;
  lastSuccessfulCheckAt: string;
  lastContentChangeAt: string;
  sources: Array<{
    id: string;
    label: string;
    status: "healthy" | "degraded" | "failed";
    recordCount: number;
    attemptedQueries?: number;
    successfulQueries?: number;
    failedQueries?: number;
    lookbackDays?: number;
    checksum?: string;
  }>;
};

export type DashboardProps = {
  initialIncidents: Incident[];
  candidateCount: number;
  indexedReports: IndexedReport[];
  researchSources: ResearchSource[];
  pipelineStatus: PipelineStatus;
  eventGroups: {
    methodologyVersion: string;
    recordToEvent: Record<string, string>;
    excludedRecords: Record<string, string>;
  };
};

const WIDTH = 1200;
const HEIGHT = 560;
const COUNTRY_CENTROID_OVERRIDES: Record<string, [number, number]> = {
  Gibraltar: [-5.35, 36.14],
};
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "United States": "United States of America",
};

function formatDate(value: string, precision: "day" | "month" | "year" = "day") {
  if (precision === "year") return new Date(`${value}T00:00:00Z`).getUTCFullYear().toString();
  if (precision === "month") return formatMonth(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function titleCase(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceLabel(value: Incident["status"]) {
  if (value === "verified") return "Source-reviewed";
  if (value === "reported") return "Publicly reported";
  return "Under review";
}

function formatUtcTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export default function Dashboard({ initialIncidents, candidateCount, indexedReports, researchSources, pipelineStatus, eventGroups }: DashboardProps) {
  const [years, setYears] = useState("10");
  const [asset, setAsset] = useState("all");
  const [evidence, setEvidence] = useState("all");
  const [country, setCountry] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [view, setView] = useState<"map" | "list" | "index">("map");
  const [mobileSection, setMobileSection] = useState<"global" | "cases" | "index" | "research">("global");
  const [showFilters, setShowFilters] = useState(false);
  const [showAllIndex, setShowAllIndex] = useState(false);
  const [liveIndexedReports, setLiveIndexedReports] = useState(indexedReports);
  const [liveCandidateCount, setLiveCandidateCount] = useState(candidateCount);
  const [livePipeline, setLivePipeline] = useState(pipelineStatus);
  const [sourceMode, setSourceMode] = useState<"daily-live-check" | "validated-snapshot">("validated-snapshot");
  const [contentDiffersFromSnapshot, setContentDiffersFromSnapshot] = useState(false);
  const filterDialogRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const cutoff = useMemo(() => {
    const now = new Date();
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCFullYear(date.getUTCFullYear() - Number(years));
    return date;
  }, [years]);

  const baseReviewed = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialIncidents.filter((incident) => {
      const inDate = new Date(`${incident.date}T00:00:00Z`) >= cutoff;
      const inAsset = asset === "all" || incident.assetType === asset;
      const inEvidence = evidence === "all" || (evidence !== "indexed" && incident.status === evidence);
      const inSearch = !needle || [incident.title, incident.city, incident.country, incident.causeCategory, incident.propertyType]
        .some((value) => value.toLowerCase().includes(needle));
      return inDate && inAsset && inEvidence && inSearch;
    });
  }, [asset, cutoff, evidence, initialIncidents, query]);

  const baseIndexed = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return liveIndexedReports.filter((report) => {
      if (eventGroups.excludedRecords[report.id]) return false;
      const inDate = new Date(`${report.date}T00:00:00Z`) >= cutoff;
      const inAsset = asset === "all" || report.assetType === asset;
      const inEvidence = evidence === "all" || evidence === "indexed";
      const inSearch = !needle || [report.title, report.country, report.propertyType, report.summary]
        .some((value) => value.toLowerCase().includes(needle));
      return inDate && inAsset && inEvidence && inSearch;
    });
  }, [asset, cutoff, evidence, eventGroups.excludedRecords, liveIndexedReports, query]);

  const filtered = useMemo(
    () => baseReviewed.filter((incident) => country === "all" || incident.country === country),
    [baseReviewed, country],
  );

  const filteredIndexed = useMemo(
    () => baseIndexed.filter((report) => country === "all" || report.country === country),
    [baseIndexed, country],
  );

  const countries = useMemo(() => [...new Set([
    ...initialIncidents.map((item) => item.country),
    ...liveIndexedReports.map((item) => item.country),
  ])].sort(), [liveIndexedReports, initialIncidents]);

  const eventId = useCallback((id: string) => eventGroups.recordToEvent[id] ?? id, [eventGroups.recordToEvent]);

  const countryCoverage = useMemo(() => {
    const result = new Map<string, { country: string; reviewed: number; indexed: number; total: number; eventIds: Set<string> }>();
    const add = (name: string, layer: "reviewed" | "indexed", id: string) => {
      const current = result.get(name) ?? { country: name, reviewed: 0, indexed: 0, total: 0, eventIds: new Set<string>() };
      current[layer] += 1;
      current.total += 1;
      current.eventIds.add(eventId(id));
      result.set(name, current);
    };
    baseReviewed.forEach((item) => add(item.country, "reviewed", item.id));
    baseIndexed.forEach((item) => add(item.country, "indexed", item.id));
    return [...result.values()]
      .map(({ eventIds, ...item }) => ({ ...item, events: eventIds.size }))
      .sort((a, b) => b.events - a.events || b.total - a.total || a.country.localeCompare(b.country));
  }, [baseIndexed, baseReviewed, eventId]);

  const stats = useMemo(() => {
    const coveredCountries = new Set([...filtered.map((item) => item.country), ...filteredIndexed.map((item) => item.country)]).size;
    return {
      reviewed: filtered.length,
      indexed: filteredIndexed.length,
      total: filtered.length + filteredIndexed.length,
      events: new Set([...filtered.map((item) => eventId(item.id)), ...filteredIndexed.map((item) => eventId(item.id))]).size,
      countries: coveredCountries,
      datasets: researchSources.length,
    };
  }, [eventId, filtered, filteredIndexed, researchSources.length]);

  const globalStats = useMemo(() => ({
    reviewed: baseReviewed.length,
    indexed: baseIndexed.length,
    total: baseReviewed.length + baseIndexed.length,
    events: new Set([...baseReviewed.map((item) => eventId(item.id)), ...baseIndexed.map((item) => eventId(item.id))]).size,
    countries: countryCoverage.length,
  }), [baseIndexed, baseReviewed, countryCoverage.length, eventId]);

  const trend = useMemo(() => {
    const result = new Map<number, number>();
    filtered.forEach((item) => {
      const year = Number(item.date.slice(0, 4));
      result.set(year, (result.get(year) ?? 0) + 1);
    });
    const currentYear = new Date().getUTCFullYear();
    const startYear = cutoff.getUTCFullYear();
    return Array.from({ length: currentYear - startYear + 1 }, (_, index) => {
      const year = startYear + index;
      return [year, result.get(year) ?? 0] as [number, number];
    });
  }, [cutoff, filtered]);

  const maxTrend = Math.max(1, ...trend.map(([, count]) => count));

  const world = useMemo(() => {
    const countries = feature(
      worldData as never,
      (worldData as unknown as { objects: { countries: never } }).objects.countries,
    );
    const projection = geoEqualEarth().fitExtent([[18, 18], [WIDTH - 18, HEIGHT - 18]], countries as never);
    const centroids = new Map<string, [number, number]>();
    for (const country of (countries as unknown as { features: Array<{ properties?: { name?: string } }> }).features) {
      const name = country.properties?.name;
      if (!name) continue;
      centroids.set(name, geoCentroid(country as never) as [number, number]);
    }
    return { countries, projection, path: geoPath(projection), centroids };
  }, []);

  const lastUpdated = useMemo(
    () => formatUtcTimestamp(livePipeline.lastSuccessfulCheckAt),
    [livePipeline.lastSuccessfulCheckAt],
  );
  const contentUpdated = useMemo(
    () => formatDate(livePipeline.lastContentChangeAt.slice(0, 10)),
    [livePipeline.lastContentChangeAt],
  );
  const pipelineStale = Date.parse(livePipeline.lastAttemptAt) - Date.parse(livePipeline.lastSuccessfulCheckAt) > 36 * 60 * 60 * 1000;

  const activeFilterCount = [years !== "10", asset !== "all", evidence !== "all", country !== "all", Boolean(query.trim())]
    .filter(Boolean).length;

  useEffect(() => {
    let active = true;
    fetch("/api/daily-feed", { headers: { accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("Daily feed unavailable");
        return response.json();
      })
      .then((payload: {
        overallStatus: PipelineStatus["overallStatus"];
        lastAttemptAt: string;
        lastSuccessfulCheckAt: string;
        lastContentChangeAt: string;
        indexedReports: IndexedReport[];
        pendingCandidateCount: number;
        sourceMode: "daily-live-check" | "validated-snapshot";
        contentDiffersFromSnapshot: boolean;
      }) => {
        if (!active || !Array.isArray(payload.indexedReports)) return;
        setLiveIndexedReports(payload.indexedReports);
        setLiveCandidateCount(payload.pendingCandidateCount);
        setSourceMode(payload.sourceMode);
        setContentDiffersFromSnapshot(Boolean(payload.contentDiffersFromSnapshot));
        setLivePipeline((current) => ({
          ...current,
          overallStatus: payload.overallStatus,
          lastAttemptAt: payload.lastAttemptAt,
          lastSuccessfulCheckAt: payload.lastSuccessfulCheckAt,
          lastContentChangeAt: payload.lastContentChangeAt,
        }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const container = showFilters ? filterDialogRef.current : selected ? drawerRef.current : null;
    if (!container) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = [...container.querySelectorAll<HTMLElement>(focusableSelector)];
    requestAnimationFrame(() => (focusable[0] ?? container).focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowFilters(false);
        setSelected(null);
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [selected, showFilters]);

  function resetFilters() {
    setYears("10");
    setAsset("all");
    setEvidence("all");
    setCountry("all");
    setQuery("");
  }

  function selectCountry(name: string) {
    setCountry(name);
    setView("map");
    setMobileSection("global");
    document.getElementById("incidents")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exportData() {
    const blob = new Blob([createIncidentCsv(filtered, filteredIndexed)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `global-pv-fire-records-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const latest = [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const scopeLabel = country === "all" ? "Global" : country;

  return (
    <main className="app-shell">
      <a className="skip-link" href="#incidents">Skip to incident explorer</a>
      <header className="masthead" id="global">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><ShieldCheck size={22} /></span>
          <div>
            <div className="eyebrow">PV fire intelligence</div>
            <h1>Global PV Fire Watch</h1>
            <p>Source-backed rooftop and solar-farm fire reporting coverage</p>
          </div>
        </div>
        <div className="header-actions">
          <div
            className={"updated-badge " + (pipelineStale || livePipeline.overallStatus !== "healthy" ? "attention" : "healthy")}
            title={sourceMode === "daily-live-check" ? "The vendor-curated public index was checked through a cache that expires within 23 hours." : "Showing the latest validated snapshot while the live source is unavailable."}
            role="status"
            aria-live="polite"
          >
            <span>Daily source check</span>
            <b>{pipelineStale ? "Stale · " : livePipeline.overallStatus === "healthy" ? "Successful · " : "Snapshot · "}{lastUpdated}</b>
          </div>
          <button className="export-button" onClick={exportData}><Download size={17} /><span>Export current view</span></button>
        </div>
      </header>

      <section className="coverage-command" aria-label={`${scopeLabel} public reporting coverage`}>
        <div className="coverage-primary">
          <span className="coverage-label"><Globe2 size={15} /> {scopeLabel} public reporting index</span>
          <div className="coverage-total-row">
            <strong>{stats.total.toLocaleString()}</strong>
            <span>public source records<small>{stats.events.toLocaleString()} provisional event clusters</small></span>
          </div>
          <div className="coverage-caveat"><Info size={14} /><span>Known duplicate and follow-up reports are grouped; clusters remain provisional and this is not a complete global census.</span></div>
          <p>Global documented reporting breadth first. Select a country to review source-checked locations and additional vendor-indexed reports.</p>
        </div>
        <div className="coverage-breakdown">
          <div><span>Event clusters</span><strong>{stats.events}</strong><small>provisional · overlap adjusted</small></div>
          <div><span>Reviewed</span><strong>{stats.reviewed}</strong><small>geolocated · incident source checked</small></div>
          <div><span>Indexed</span><strong>{stats.indexed}</strong><small>vendor-curated · awaiting review</small></div>
          <div><span>Countries</span><strong>{stats.countries}</strong><small>in the current scope</small></div>
        </div>
      </section>

      <section className="country-explorer" aria-label="Reporting coverage by country">
        <div className="country-explorer-head">
          <div><h2>Reporting coverage by country</h2><small>Provisional events and source volume—not comparative fire-risk rates</small></div>
          {country !== "all" && <button onClick={() => selectCountry("all")}>Back to global</button>}
        </div>
        <div className="country-strip">
          <button className={country === "all" ? "active" : ""} aria-pressed={country === "all"} onClick={() => selectCountry("all")}>
            <span>Global</span><strong>{globalStats.events}</strong><small>{globalStats.total} source records</small><Globe2 size={17} />
            <span className="country-share" aria-hidden="true"><i style={{ width: "100%" }} /></span>
          </button>
          {countryCoverage.map((item) => (
            <button key={item.country} className={country === item.country ? "active" : ""} aria-pressed={country === item.country} onClick={() => selectCountry(item.country)}>
              <span>{item.country}</span><strong>{item.events}</strong><small>{item.total} records · {item.reviewed} reviewed</small><ChevronRight size={17} />
              <span className="country-share" aria-hidden="true"><i style={{ width: `${Math.max(4, Math.round(item.events / Math.max(1, globalStats.events) * 100))}%` }} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="workspace" id="incidents">
        <div className="workspace-head">
          <div>
            <span className="scope-breadcrumb">Global coverage <b>/</b> {country === "all" ? "All countries" : country}</span>
            <h2>{stats.events.toLocaleString()} provisional events in {scopeLabel}</h2>
            <p>{stats.total} source records · {stats.reviewed} reviewed · {stats.indexed} vendor-indexed</p>
          </div>
          <div className="layer-key"><span><i className="country-layer" /> Provisional event total</span><span><i className="reviewed-layer" /> Reviewed location</span></div>
        </div>

        <div className="mobile-toolbar">
          <button
            className="mobile-filter-button"
            aria-expanded={showFilters}
            aria-controls="mobile-filter-dialog"
            onClick={() => setShowFilters(true)}
          ><Filter size={17} /> Filters {activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
          <div className="mobile-scope-chips"><span>{years} years</span><span>{country === "all" ? "All countries" : country}</span><span>{evidence === "all" ? "All evidence" : titleCase(evidence)}</span></div>
        </div>

        {showFilters && <button className="filter-backdrop" aria-label="Close filters" onClick={() => setShowFilters(false)} />}
        <div
          id="mobile-filter-dialog"
          ref={filterDialogRef}
          className={`filter-bar ${showFilters ? "open" : ""}`}
          role={showFilters ? "dialog" : undefined}
          aria-modal={showFilters || undefined}
          aria-labelledby={showFilters ? "filter-dialog-title" : undefined}
          tabIndex={-1}
        >
          <div className="filter-sheet-head"><div><span id="filter-dialog-title">Filter records</span><small>{stats.total} results in current scope</small></div><button aria-label="Close filters" onClick={() => setShowFilters(false)}><X size={19} /></button></div>
          <label><CalendarDays size={16} /><span className="sr-only">Date range</span>
            <select value={years} onChange={(event) => setYears(event.target.value)}>
              <option value="10">Date · Last 10 years</option>
              <option value="5">Date · Last 5 years</option>
              <option value="3">Date · Last 3 years</option>
            </select>
          </label>
          <label><Layers3 size={16} /><span className="sr-only">Asset type</span>
            <select value={asset} onChange={(event) => setAsset(event.target.value)}>
              <option value="all">Asset type · All</option>
              <option value="rooftop">Rooftop</option>
              <option value="utility">Utility-scale</option>
            </select>
          </label>
          <label><ShieldCheck size={16} /><span className="sr-only">Evidence layer</span>
            <select value={evidence} onChange={(event) => setEvidence(event.target.value)}>
              <option value="all">Evidence · All layers</option>
              <option value="verified">Reviewed · Source-reviewed</option>
              <option value="reported">Reviewed · Publicly reported</option>
              <option value="indexed">Vendor-indexed reports</option>
            </select>
          </label>
          <label><Globe2 size={16} /><span className="sr-only">Country</span>
            <select value={country} onChange={(event) => setCountry(event.target.value)}>
              <option value="all">Country · All</option>
              {countries.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="search-control"><Search size={16} /><span className="sr-only">Search incidents</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search place or cause" />
            {query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}
          </label>
          <div className="view-toggle" role="group" aria-label="View selector">
            <button aria-pressed={view === "map"} className={view === "map" ? "active" : ""} onClick={() => setView("map")}>Coverage</button>
            <button aria-pressed={view === "list"} className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Reviewed</button>
            <button aria-pressed={view === "index"} className={view === "index" ? "active" : ""} onClick={() => setView("index")}>Index</button>
          </div>
          <div className="filter-sheet-actions"><button onClick={resetFilters}>Clear all</button><button onClick={() => setShowFilters(false)}>Show {stats.total} records</button></div>
        </div>

        {view === "map" ? (
          <div className="map-layout">
            <div className="map-panel">
              <svg className="world-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`Interactive global reporting map showing ${globalStats.events} provisional events from ${globalStats.total} source records and ${filtered.length} reviewed locations`}>
                <title>Interactive global PV fire public reporting coverage</title>
                <desc>Country bubbles show provisional event clusters. Red and amber points open reviewed incident details.</desc>
                <rect width={WIDTH} height={HEIGHT} className="map-bg" />
                <g className="graticule-lines">
                  {[140, 280, 420].map((y) => <line key={`h-${y}`} x1="0" x2={WIDTH} y1={y} y2={y} />)}
                  {[200, 400, 600, 800, 1000].map((x) => <line key={`v-${x}`} x1={x} x2={x} y1="0" y2={HEIGHT} />)}
                </g>
                <g className="countries">
                  {(world.countries as unknown as { features: { id?: string; type: string; properties: object; geometry: never }[] }).features.map((country, index) => (
                    <path key={country.id ?? `country-${index}`} d={world.path(country as never) ?? ""} />
                  ))}
                </g>
                <g className="coverage-bubbles">
                  {countryCoverage.map((item) => {
                    const coordinates = COUNTRY_CENTROID_OVERRIDES[item.country]
                      ?? world.centroids.get(COUNTRY_NAME_ALIASES[item.country] ?? item.country);
                    const point = coordinates ? world.projection(coordinates) : null;
                    if (!point) return null;
                    const radius = Math.min(28, 10 + Math.sqrt(item.events) * 2);
                    return (
                      <g
                        key={`coverage-${item.country}`}
                        className={`coverage-bubble ${country === item.country ? "active" : ""} ${country !== "all" && country !== item.country ? "muted" : ""}`}
                        transform={`translate(${point[0].toFixed(4)},${point[1].toFixed(4)})`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${item.country}: ${item.events} provisional events from ${item.total} source records`}
                        aria-pressed={country === item.country}
                        onClick={() => selectCountry(item.country)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectCountry(item.country);
                          }
                        }}
                      >
                        <circle className="coverage-hit" r={Math.max(radius, 32)} />
                        <circle className="coverage-ring" r={radius} />
                        <text textAnchor="middle" dominantBaseline="central">{item.events}</text>
                      </g>
                    );
                  })}
                </g>
                <g className="markers">
                  {filtered.map((incident) => {
                    const point = world.projection([incident.lng, incident.lat]);
                    if (!point) return null;
                    const isVerified = incident.status === "verified";
                    const isMajor = incident.severity === "major" || incident.severity === "catastrophic";
                    return (
                      <g
                        key={incident.id}
                        className="marker-group"
                        transform={`translate(${point[0].toFixed(4)},${point[1].toFixed(4)})`}
                        tabIndex={0}
                        role="button"
                        aria-label={`${incident.title}, ${incident.country}, ${evidenceLabel(incident.status)}`}
                        onClick={() => setSelected(incident)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelected(incident);
                          }
                        }}
                      >
                        <circle className="marker-hit" r="16" />
                        {isMajor && <circle className={`marker-halo ${isVerified ? "verified" : "reported"}`} r="12" />}
                        <circle
                          className={`marker ${isVerified ? "verified" : "reported"}`}
                          r={isMajor ? 5.3 : 4}
                        />
                      </g>
                    );
                  })}
                </g>
              </svg>
              <div className="map-legend">
                <span><i className="coverage" /> Provisional event total</span>
                <span><i className="verified" /> Source-reviewed location</span>
                <span><i className="reported" /> Publicly reported location</span>
                <span className="legend-total">{filtered.length} mapped locations · {stats.total} records</span>
              </div>
              <div className="map-note">Marker locations are approximate at city/site level</div>
            </div>
            <aside className="incident-rail">
              <div className="rail-header">
                <div><h3>Latest reviewed incidents</h3><small>{scopeLabel} · incident-level sources</small></div>
                <CircleDot size={18} />
              </div>
              <div className="rail-list">
                {latest.length === 0 && <div className="rail-empty"><FileSearch size={20} /><span>No reviewed locations match this scope.</span><button onClick={resetFilters}>Clear filters</button></div>}
                {latest.map((incident) => (
                  <button key={incident.id} onClick={() => setSelected(incident)}>
                    <i className={incident.status} />
                    <span><b>{incident.title}</b><small>{formatDate(incident.date, incident.datePrecision)} · {incident.country}</small></span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              <div className="queue-card"><FileSearch size={18} /><span><b>{liveCandidateCount} reports pending review</b><small>Global discovery queue · not mapped</small></span></div>
            </aside>
          </div>
        ) : view === "list" ? (
          <div className="list-view">
            <div className="view-section-head"><div><h3>Reviewed incident register</h3><small>{filtered.length} incident-level records in {scopeLabel}</small></div><ShieldCheck size={18} /></div>
            <div className="table-head"><span>Date</span><span>Incident</span><span>Asset</span><span>Evidence</span><span>Cause</span><span /></div>
            {filtered.length === 0 && <div className="zero-state"><FileSearch size={23} /><strong>No reviewed incidents match</strong><span>Change the evidence layer or clear the current filters.</span><button onClick={resetFilters}>Clear filters</button></div>}
            {latest.concat(filtered.filter((item) => !latest.includes(item))).map((incident) => (
              <button className="table-row" key={incident.id} onClick={() => setSelected(incident)}>
                <span className="row-date">{formatDate(incident.date, incident.datePrecision)}</span>
                <span className="row-main"><b>{incident.title}</b><small>{incident.city}, {incident.country}</small><em>{formatDate(incident.date, incident.datePrecision)} · {titleCase(incident.assetType)} · {titleCase(incident.pvRole)} PV role</em></span>
                <span className="row-asset">{titleCase(incident.assetType)}</span>
                <span className="row-evidence"><i className={incident.status} /> {evidenceLabel(incident.status)}</span>
                <span className="row-cause">{incident.causeCategory}</span>
                <ChevronRight className="row-arrow" size={16} />
              </button>
            ))}
          </div>
        ) : (
          <div className="public-index embedded-index">
            <div className="index-header">
              <div><h3>Vendor-indexed public reports</h3><small>{filteredIndexed.length} country-level discovery records after current filters</small></div>
              <div className="index-legend"><i /> Awaiting incident-level review</div>
            </div>
            <div className="index-table-head"><span>Month</span><span>Public report</span><span>Country</span><span>Asset</span><span>Source</span></div>
            <div className="index-rows">
              {filteredIndexed.length === 0 && <div className="zero-state"><FileSearch size={23} /><strong>No indexed reports match</strong><span>Change the evidence layer or clear the current filters.</span><button onClick={resetFilters}>Clear filters</button></div>}
              {filteredIndexed.slice(0, showAllIndex ? filteredIndexed.length : 24).map((report) => (
                <a key={report.id} href={report.sourceUrl} target="_blank" rel="noreferrer" className="index-row">
                  <span className="index-date">{formatMonth(report.date)}</span>
                  <span className="index-main"><b>{report.title}</b><small>{report.summary}</small><em>{report.country} · {titleCase(report.assetType)} · {formatMonth(report.date)}</em><span className="sr-only"> Opens in a new tab.</span></span>
                  <span className="index-country">{report.country}</span>
                  <span className="index-asset">{titleCase(report.assetType)}</span>
                  <ExternalLink size={15} />
                </a>
              ))}
            </div>
            {filteredIndexed.length > 24 && (
              <button className="show-index-button" onClick={() => setShowAllIndex((value) => !value)}>{showAllIndex ? "Show fewer reports" : `Show all ${filteredIndexed.length} reports`}</button>
            )}
          </div>
        )}
      </section>

      <details className="disclosure">
        <summary><Info size={16} /><span><strong>Coverage & methodology</strong><small>Why record totals and mapped cases differ</small></span><ChevronRight size={15} /></summary>
        <p>On a visit after the cache expires, the public index is checked again within a 23-hour maximum cache window. Records enter the reviewed layer only after human validation. No global authority records every PV fire. Known overlapping reports are grouped into provisional event clusters, and all coordinates are approximate. Counts are not normalized risk rates. <a href="/methodology">Read the full methodology.</a></p>
      </details>

      <section className="analysis-grid">
        <article className="analysis-card trend-card">
          <div className="section-title"><div><h2>Reviewed incident trend</h2><small>Incident-level records only · not a normalized fire rate</small></div><Activity size={19} /></div>
          <div className="trend-chart">
            {trend.length === 0 && <div className="trend-empty">No reviewed cases in this filter scope.</div>}
            {trend.map(([year, count]) => <div key={year} className="trend-column"><b>{count}</b><i style={{ height: `${Math.max(12, count / maxTrend * 112)}px` }} /><span>{year}</span></div>)}
          </div>
        </article>
        <article className="analysis-card methodology-card">
          <div className="section-title"><div><h2>Evidence protocol</h2><small>Designed for auditability</small></div><ShieldCheck size={19} /></div>
          <div className="protocol-grid">
            <div><CheckCircle2 /><span><b>Source-reviewed</b><small>Authority, technical investigation, or corroborated reporting supports the stated relationship</small></span></div>
            <div><AlertTriangle /><span><b>Publicly reported</b><small>A credible incident report describes PV involvement without a final finding</small></span></div>
            <div><Filter /><span><b>Excluded</b><small>BESS-only events, wildfire damage without PV ignition, and duplicate reports</small></span></div>
          </div>
        </article>
      </section>

      <section className="research-section" id="research">
        <div className="research-heading">
          <div>
            <div className="eyebrow"><FileSearch size={14} /> Coverage evidence</div>
            <h2>Aggregate research and data limitations</h2>
            <p>National statistics, forensic studies and public-report indexes reveal substantially more events than can be responsibly geolocated. The layers below remain separate because periods, definitions and territories overlap; in the U.S., federal coding does not cleanly identify PV-origin fires.</p>
          </div>
          <div className="nonadditive-badge"><AlertTriangle size={16} /><span><b>Non-additive datasets</b><small>Source totals overlap</small></span></div>
        </div>

        <div className="evidence-summary">
          <div><strong>468</strong><span>England IRS mentions</span><small>2016–H1 2025</small></div>
          <div><strong>217</strong><span>NSW associated fires</span><small>2018–2020</small></div>
          <div><strong>152</strong><span>Netherlands buildings</span><small>solar present, 2022–2023</small></div>
          <div><strong>30</strong><span>Netherlands PV origins</span><small>confirmed among 70 investigated</small></div>
        </div>

        <div className="source-grid">
          {researchSources.map((source) => (
            <article className={`source-card ${source.windowRelation}`} key={source.id}>
              <div className="source-card-top">
                <span className="source-class">{source.sourceClass}</span>
                <span className="period-pill">{source.period}</span>
              </div>
              <div className="source-number-row"><strong>{source.count === null ? "—" : source.count.toLocaleString()}</strong><span>{source.metric}</span></div>
              {source.confirmedPvOrigin !== null && (
                <div className="origin-line"><CheckCircle2 size={14} /><b>{source.confirmedPvOrigin.toLocaleString()}</b> identified as PV-origin or PV-caused under that source&apos;s method</div>
              )}
              <h3>{source.jurisdiction}</h3>
              <p>{source.caveat}</p>
              {source.yearly && (
                <div className="micro-bars" aria-label={`Annual counts for ${source.jurisdiction}`}>
                  {Object.entries(source.yearly).map(([year, count]) => (
                    <div key={year} title={`${year}: ${count}`}><i style={{ height: `${Math.max(8, count / Math.max(...Object.values(source.yearly!)) * 42)}px` }} /><span>{year.slice(2)}</span></div>
                  ))}
                </div>
              )}
              <a href={source.sourceUrl} target="_blank" rel="noreferrer">Open source <span className="sr-only">in a new tab</span><ExternalLink size={13} /></a>
            </article>
          ))}
        </div>

      </section>

      <footer>
        <div><ShieldCheck size={17} /><strong>Global PV Fire Watch</strong><span>Open incident intelligence for prevention, engineering and insurance.</span></div>
        <div className="footer-meta"><span>Last successful check · {lastUpdated}</span><span>·</span><span>Snapshot changed {contentUpdated}</span>{contentDiffersFromSnapshot && <><span>·</span><span>Live source differs from snapshot</span></>}</div>
        <nav aria-label="Project policies"><a href="/methodology">Methodology</a><a href="/data-policy">Data policy</a><a href="/corrections">Corrections</a></nav>
      </footer>

      <nav className="mobile-nav" aria-label="Mobile dashboard navigation">
        <button className={mobileSection === "global" ? "active" : undefined} aria-pressed={mobileSection === "global"} onClick={() => { setMobileSection("global"); setCountry("all"); setView("map"); document.getElementById("global")?.scrollIntoView({ behavior: "smooth" }); }}><Globe2 size={17} /><span>Global</span></button>
        <button className={mobileSection === "cases" ? "active" : undefined} aria-pressed={mobileSection === "cases"} onClick={() => { setMobileSection("cases"); setView("list"); document.getElementById("incidents")?.scrollIntoView({ behavior: "smooth" }); }}><ShieldCheck size={17} /><span>Cases</span></button>
        <button className={mobileSection === "index" ? "active" : undefined} aria-pressed={mobileSection === "index"} onClick={() => { setMobileSection("index"); setView("index"); document.getElementById("incidents")?.scrollIntoView({ behavior: "smooth" }); }}><FileSearch size={17} /><span>Index</span></button>
        <button className={mobileSection === "research" ? "active" : undefined} aria-pressed={mobileSection === "research"} onClick={() => { setMobileSection("research"); document.getElementById("research")?.scrollIntoView({ behavior: "smooth" }); }}><Layers3 size={17} /><span>Research</span></button>
      </nav>

      {selected && (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <aside ref={drawerRef} className="incident-drawer" aria-modal="true" role="dialog" aria-labelledby="incident-title" tabIndex={-1}>
            <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Close incident details"><X /></button>
            <div className="drawer-kicker"><span className={`status-pill ${selected.status}`}><i />{evidenceLabel(selected.status)}</span><span>{formatDate(selected.date, selected.datePrecision)}</span></div>
            <h2 id="incident-title">{selected.title}</h2>
            <p className="drawer-place"><MapPin size={16} /> {selected.city}, {selected.country}</p>
            <div className="drawer-tags"><span>{titleCase(selected.assetType)}</span><span>{selected.propertyType}</span><span className={`severity-${selected.severity}`}>{titleCase(selected.severity)} reported impact</span></div>
            <section><h3>Incident summary</h3><p>{selected.summary}</p></section>
            <section><h3>PV relationship</h3><p><b>{titleCase(selected.pvRole)}:</b> {selected.cause}</p></section>
            <div className="drawer-facts">
              <div><span>Cause category</span><b>{selected.causeCategory}</b></div>
              <div><span>Known injuries</span><b>{selected.injuries ?? "Not reported"}</b></div>
              <div><span>Source class</span><b>{titleCase(selected.sourceType)}</b></div>
              <div><span>Location precision</span><b>Approximate city/site point</b></div>
            </div>
            <a className="source-link" href={selected.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} /> Open source: {selected.sourceTitle}<span className="sr-only"> in a new tab</span></a>
            <div className="drawer-caveat"><Info size={16} /> Status describes evidence strength, not legal causation or liability.</div>
          </aside>
        </div>
      )}
    </main>
  );
}
