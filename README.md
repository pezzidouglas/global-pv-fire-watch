# Global PV Fire Watch

An open, source-backed dashboard for publicly reported photovoltaic fire incidents affecting rooftops, solar farms, and floating PV systems.

## Why this exists

No global fire authority maintains a complete, standardized registry of PV-related fires. Many national incident systems classify PV events under broader electrical or structural-fire categories. This project therefore publishes **observable coverage, not a census** and keeps evidence strength visible for every record.

## What is included

- Full-globe coverage map with provisional country event counts and approximate reviewed-case locations
- Global-to-country drill-down with separate reviewed and source-indexed registers
- Mobile-first touch layout with compact statistics, filter sheet, vertical case cards, and bottom navigation
- Rooftop vs. utility-scale segmentation
- Country, date, asset, evidence-status, and keyword filters
- Source-reviewed vs. publicly reported evidence labels
- Ten-, five-, and three-year filters
- Search, coverage/reviewed/index views, trend chart, and combined CSV export
- Source URL and PV-causation language for every reviewed incident
- On-access source checks with a cache that expires within 23 hours and a validated-snapshot fallback
- Daily multilingual discovery automation for GitHub mirrors
- A separately labelled public-report index that is never treated as verified by default
- Structured community incident-submission template

## Daily update process

The live dashboard checks the public-report index through a server endpoint whose successful edge cache expires after 23 hours. A failed, oversized, malformed or suspiciously small response cannot erase the dataset; the last validated snapshot remains visible and the interface marks that state. This is a daily-on-access check: a true background run requires the GitHub workflow or another scheduler.

In a GitHub mirror, the `Daily PV fire discovery` workflow runs at 14:17 UTC every day. It searches a 21-day overlap window in English, Spanish, French, German, Italian, Portuguese, and Dutch using region-appropriate news locales. New matches enter `data/candidates.json` as **pending candidates**. They do not become reviewed incidents automatically. A reviewer must validate the location, date, PV relationship, duplicate status, and source quality before promoting a record to `data/incidents.json`.

The discovery job has read-only repository access. A separate publication job accepts only the three validated JSON files and opens or updates a bot pull request; it never pushes automated data directly to protected `main`. The workflow refreshes `data/indexed-reports.json`, records source health in `data/pipeline-status.json`, and rejects empty or abnormally small imports.

This two-stage approach prevents headlines, BESS-only events, duplicate syndication, and unrelated wildfires from silently becoming facts in the dashboard.

## Run locally

```bash
npm ci
npm run dev
```

Validate a production build:

```bash
npm test
```

Run discovery manually:

```bash
node scripts/update-incidents.mjs
node scripts/import-public-index.mjs
```

## Data fields

See [`data/README.md`](data/README.md) and the public [`methodology`](app/methodology/page.tsx) for inclusion rules and evidence labels. Each reviewed record contains an approximate location, asset type, property type, reported impact class, PV role, cause language, source class, source URL, summary, injury count, and known loss when public. `data/event-groups.json` records high-confidence duplicate and follow-up links.

## Important limitation

Incident counts cannot be used as a fire rate without a defensible exposure denominator, reporting-adjustment method, and jurisdictional coverage model. The year chart shows published records in this repository—not the true incidence rate of PV fires.

## License

Code: MIT. Project-authored factual metadata and original explanatory text: CC BY 4.0 to the extent owned. Third-party titles, linked articles, datasets and marks are excluded. See [`DATA_LICENSE.md`](DATA_LICENSE.md).
