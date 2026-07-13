import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileSearch,
  Globe2,
  Info,
  Layers3,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { getCountryDetail, listCountries } from "@shared/countryData";

function formatDate(value: string, precision: "day" | "month" | "year" = "day") {
  if (precision === "year") return new Date(`${value}T00:00:00Z`).getUTCFullYear().toString();
  const options: Intl.DateTimeFormatOptions =
    precision === "month"
      ? { month: "short", year: "numeric", timeZone: "UTC" }
      : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en-US", options).format(new Date(`${value}T00:00:00Z`));
}

function titleCase(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceLabel(status: string) {
  if (status === "verified") return "Source-reviewed";
  if (status === "reported") return "Publicly reported";
  return "Under review";
}

export default function CountryPage() {
  const params = useParams<{ slug: string }>();
  const detail = useMemo(() => getCountryDetail(params.slug ?? ""), [params.slug]);
  const siblings = useMemo(() => listCountries(), []);
  const [showAllIndexed, setShowAllIndexed] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = detail
      ? `${detail.country} · Global PV Fire Watch`
      : "Country not found · Global PV Fire Watch";
  }, [detail]);

  if (!detail) {
    return (
      <main className="app-shell info-shell">
        <header className="masthead">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true"><ShieldCheck size={22} /></span>
            <div>
              <div className="eyebrow">PV fire intelligence</div>
              <h1>Country not found</h1>
              <p>No reporting coverage exists for this country yet.</p>
            </div>
          </div>
        </header>
        <section className="country-page-empty">
          <FileSearch size={26} />
          <p>This country has no reviewed incidents or vendor-indexed reports in the current dataset.</p>
          <Link href="/" className="back-link"><ArrowLeft size={16} /> Back to global dashboard</Link>
        </section>
      </main>
    );
  }

  const trend = (() => {
    const counts = new Map<number, number>();
    detail.reviewed.forEach((incident) => {
      const year = Number(incident.date.slice(0, 4));
      counts.set(year, (counts.get(year) ?? 0) + 1);
    });
    const currentYear = new Date().getUTCFullYear();
    const years: Array<[number, number]> = [];
    for (let year = 2016; year <= currentYear; year += 1) years.push([year, counts.get(year) ?? 0]);
    return years;
  })();
  const maxTrend = Math.max(1, ...trend.map(([, count]) => count));
  const indexedVisible = showAllIndexed ? detail.indexed : detail.indexed.slice(0, 12);
  const otherCountries = siblings.filter((item) => item.slug !== detail.slug).slice(0, 8);

  return (
    <main className="app-shell country-page">
      <a className="skip-link" href="#country-incidents">Skip to incident list</a>
      <header className="masthead">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><ShieldCheck size={22} /></span>
          <div>
            <div className="eyebrow">PV fire intelligence · Country detail</div>
            <h1>{detail.country}</h1>
            <p>Source-backed PV fire reporting coverage and national statistics</p>
          </div>
        </div>
        <div className="header-actions">
          <Link href="/" className="back-link header-back"><ArrowLeft size={16} /> Global dashboard</Link>
        </div>
      </header>

      <section className="coverage-command" aria-label={`${detail.country} reporting coverage`}>
        <div className="coverage-primary">
          <span className="coverage-label"><Globe2 size={15} /> {detail.country} public reporting index</span>
          <div className="coverage-total-row">
            <strong>{detail.totalRecords.toLocaleString()}</strong>
            <span>public source records<small>{detail.events.toLocaleString()} provisional event clusters</small></span>
          </div>
          <div className="coverage-caveat"><Info size={14} /><span>Counts reflect documented public reporting breadth, not comparative national fire-risk rates.</span></div>
          <p>Reviewed incidents are geolocated and source-checked; vendor-indexed reports await incident-level review.</p>
        </div>
        <div className="coverage-breakdown">
          <div><span>Event clusters</span><strong>{detail.events}</strong><small>provisional · overlap adjusted</small></div>
          <div><span>Reviewed</span><strong>{detail.reviewed.length}</strong><small>geolocated · source checked</small></div>
          <div><span>Indexed</span><strong>{detail.indexed.length}</strong><small>vendor-curated · awaiting review</small></div>
          <div><span>National datasets</span><strong>{detail.research.length}</strong><small>jurisdiction-specific sources</small></div>
        </div>
      </section>

      {detail.research.length > 0 && (
        <section className="research-section country-research" aria-label={`${detail.country} national statistics`}>
          <div className="research-heading">
            <div>
              <div className="eyebrow"><FileSearch size={14} /> National statistics</div>
              <h2>Official and research datasets for {detail.country}</h2>
              <p>Aggregate sources are shown separately from mapped incidents because periods, definitions and territories differ. Totals are non-additive.</p>
            </div>
          </div>
          <div className="source-grid">
            {detail.research.map((source) => (
              <article className={`source-card ${source.windowRelation}`} key={source.id ?? source.sourceTitle}>
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
                      <div key={year} title={`${year}: ${count}`}><i style={{ height: `${Math.max(8, (count / Math.max(...Object.values(source.yearly!))) * 42)}px` }} /><span>{year.slice(2)}</span></div>
                    ))}
                  </div>
                )}
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">Open source <span className="sr-only">in a new tab</span><ExternalLink size={13} /></a>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="analysis-grid country-analysis">
        <article className="analysis-card trend-card">
          <div className="section-title"><div><h2>Reviewed incident trend</h2><small>{detail.country} · incident-level records only</small></div><Activity size={19} /></div>
          <div className="trend-chart">
            {detail.reviewed.length === 0 && <div className="trend-empty">No reviewed incidents recorded for {detail.country} yet.</div>}
            {detail.reviewed.length > 0 && trend.map(([year, count]) => (
              <div key={year} className="trend-column"><b>{count}</b><i style={{ height: `${Math.max(12, (count / maxTrend) * 112)}px` }} /><span>{year}</span></div>
            ))}
          </div>
        </article>
        <article className="analysis-card methodology-card">
          <div className="section-title"><div><h2>Coverage notes</h2><small>How to read this page</small></div><ShieldCheck size={19} /></div>
          <div className="protocol-grid">
            <div><CheckCircle2 /><span><b>Reviewed layer</b><small>Geolocated incidents whose PV relationship is supported by authority or corroborated reporting</small></span></div>
            <div><Layers3 /><span><b>Indexed layer</b><small>Country-level vendor-curated public reports awaiting incident-level review</small></span></div>
            <div><Info /><span><b>Not a risk rate</b><small>Reporting volume tracks media and authority coverage, not normalized fire frequency</small></span></div>
          </div>
        </article>
      </section>

      <section className="workspace country-incidents" id="country-incidents" aria-label={`${detail.country} reviewed incidents`}>
        <div className="workspace-head">
          <div>
            <span className="scope-breadcrumb"><Link href="/">Global coverage</Link> <b>/</b> {detail.country}</span>
            <h2>{detail.reviewed.length} reviewed incident{detail.reviewed.length === 1 ? "" : "s"}</h2>
            <p>Incident-level, source-checked records with approximate city/site locations</p>
          </div>
        </div>
        <div className="list-view">
          {detail.reviewed.length === 0 && (
            <div className="zero-state"><FileSearch size={23} /><strong>No reviewed incidents yet</strong><span>Vendor-indexed reports for {detail.country} appear below while awaiting review.</span></div>
          )}
          {detail.reviewed.map((incident) => (
            <a className="table-row country-incident-row" key={incident.id} href={incident.sourceUrl} target="_blank" rel="noreferrer">
              <span className="row-date">{formatDate(incident.date, incident.datePrecision ?? "day")}</span>
              <span className="row-main">
                <b>{incident.title}</b>
                <small><MapPin size={12} /> {incident.city}, {incident.region}</small>
                <em>{titleCase(incident.assetType)} · {titleCase(incident.pvRole)} PV role · {incident.causeCategory}</em>
              </span>
              <span className="row-asset">{titleCase(incident.assetType)}</span>
              <span className="row-evidence"><i className={incident.status} /> {evidenceLabel(incident.status)}</span>
              <span className="row-cause">{incident.causeCategory}</span>
              <ExternalLink className="row-arrow" size={15} />
            </a>
          ))}
        </div>
      </section>

      {detail.indexed.length > 0 && (
        <section className="public-index embedded-index country-indexed" aria-label={`${detail.country} vendor-indexed reports`}>
          <div className="index-header">
            <div><h3>Vendor-indexed public reports</h3><small>{detail.indexed.length} country-level discovery records for {detail.country}</small></div>
            <div className="index-legend"><i /> Awaiting incident-level review</div>
          </div>
          <div className="index-rows">
            {indexedVisible.map((report) => (
              <a key={report.id} href={report.sourceUrl} target="_blank" rel="noreferrer" className="index-row">
                <span className="index-date">{formatDate(report.date, "month")}</span>
                <span className="index-main"><b>{report.title}</b><small>{report.summary}</small><em>{titleCase(report.assetType)} · {formatDate(report.date, "month")}</em><span className="sr-only"> Opens in a new tab.</span></span>
                <span className="index-asset">{titleCase(report.assetType)}</span>
                <ExternalLink size={15} />
              </a>
            ))}
          </div>
          {detail.indexed.length > 12 && (
            <button className="show-index-button" onClick={() => setShowAllIndexed((value) => !value)}>
              {showAllIndexed ? "Show fewer reports" : `Show all ${detail.indexed.length} reports`}
            </button>
          )}
        </section>
      )}

      {detail.internationalBenchmarks.length > 0 && (
        <details className="disclosure country-benchmark">
          <summary><Info size={16} /><span><strong>International benchmark context</strong><small>Cross-country comparative research</small></span><ChevronRight size={15} /></summary>
          {detail.internationalBenchmarks.map((source) => (
            <p key={source.id ?? source.sourceTitle}>
              <b>{source.jurisdiction} ({source.period}):</b> {source.caveat}{" "}
              <a href={source.sourceUrl} target="_blank" rel="noreferrer">Open source<span className="sr-only"> in a new tab</span></a>
            </p>
          ))}
        </details>
      )}

      <section className="country-switcher" aria-label="Other covered countries">
        <h2>Other covered countries</h2>
        <div className="country-switch-grid">
          {otherCountries.map((item) => (
            <Link key={item.slug} href={`/country/${item.slug}`} className="country-switch-card">
              <span>{item.country}</span>
              <strong>{item.events}</strong>
              <small>{item.reviewed + item.indexed} records</small>
              <ChevronRight size={15} />
            </Link>
          ))}
        </div>
      </section>

      <footer>
        <div><ShieldCheck size={17} /><strong>Global PV Fire Watch</strong><span>Open incident intelligence for prevention, engineering and insurance.</span></div>
        <nav aria-label="Project policies"><Link href="/">Dashboard</Link><a href="/methodology">Methodology</a><a href="/data-policy">Data policy</a><a href="/corrections">Corrections</a></nav>
      </footer>
    </main>
  );
}
