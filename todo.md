# Project TODO — Global PV Fire Watch (Manus rebuild)

- [x] Port incident/data layer from original repo (incidents, countries, aggregate stats) into shared typed data module
- [x] Dark mission-control design system in index.css (layered surfaces, glows, gradient headlines, amber shield brand)
- [x] Amber shield favicon + header logo (no flame imagery anywhere)
- [x] Interactive D3 world map: country bubbles sized by event count, glowing red/amber reviewed/reported markers, radial ocean gradient, glassy legend
- [x] Country coverage strip with proportional share bars, clickable to filter map + list
- [x] Incident explorer: filters (date range, asset type, evidence layer, country, text search) + latest reviewed incidents list
- [x] Reviewed incident trend chart (gradient amber bars, gridlines, hover states, 2016–present)
- [x] Evidence protocol section (source-reviewed / publicly reported / excluded)
- [x] Aggregate research & data limitations section with England IRS, NSW, Netherlands stat cards
- [x] Export current view button
- [x] /api/daily-feed endpoint with live public index check + validated snapshot fallback
- [x] Methodology, Data Policy, Corrections info pages with shield brand
- [x] robots.txt and sitemap.xml routes
- [x] Responsive/mobile layout verified (390px full-page screenshots)
- [x] Vitest coverage for daily-feed parsing/fallback and data integrity (12 tests passing)
- [x] Shared typed data module (shared/pvFireWatchData.ts) with runtime validation + test
- [x] Checkpoint saved (b2b38aaf)
- [x] Code pushed to pezzidouglas/global-pv-fire-watch GitHub repo (manus-app branch)

## Follow-up: more sources + true daily refresh

- [x] Research additional credible PV fire sources (national fire stats, research datasets, incident indexes)
- [x] Add best new aggregate research sources to research-sources data + dashboard cards (Italy CNVVF, Slovenia URSZR, international 29/GW benchmark)
- [x] Implement daily Heartbeat cron handler at /api/scheduled/daily-refresh (cron to be created after deploy)
- [x] Persist last daily-check result in DB (daily_checks table) so status survives serverless cold starts
- [x] Tests for the scheduled refresh handler (13 tests passing)
- [x] Checkpoint saved (042a01fe); awaiting user re-publish, then create Heartbeat cron
- [x] Create + verify daily Heartbeat cron after user publishes the new version (task_uid VcxHMo2zJ7ctW4zyqzUPaS, 04:17 UTC daily; verified end-to-end: test-fired run a2vsYSbN3KdYiP4qtwBvpi returned 200 {ok:true, healthy, 121 reports}, and production /api/daily-feed now serves the cron-written check timestamp 2026-07-13T05:09:06Z from the DB)
- [x] Push updates to GitHub manus-app branch (042a01f)

## Follow-up 2: country detail pages + What's new panel

- [x] Country detail route /country/:slug with national statistics + incident list for that country (16 countries)
- [x] Country pages linked from the coverage strip (detail-page link when a country is selected) + scope summary inline link + sitemap entries
- [x] Country page: reporting-index header stats, national dataset cards (jurisdiction-mapped incl. England→UK, NSW/Victoria→Australia), per-country trend chart, reviewed incident list, vendor-indexed reports with show-all, benchmark context, other-countries switcher grid
- [x] "What's new" panel on dashboard showing new indexed reports since validated snapshot (has-new + all-clear states, show-all toggle, review caveat)
- [x] Server: daily-feed payload extended with newReports diff vs snapshot (empty in fallback mode)
- [x] Tests for the diff logic and country data selectors (19 tests passing, tsc clean)
- [x] Responsive check (390px) for new pages/panel
- [x] Checkpoint (f4ba1403) + push to GitHub manus-app branch (f4ba140)

### Gap fixes before checkpoint

- [x] Recompute newReports server-side when serving persisted payloads that predate the field (normalizePersistedPayload in dailyFeed.ts)
- [x] Test covering legacy persisted payloads without newReports (21 tests passing)
- [x] Verify What's new panel state: investigated — live index currently has 0 reports beyond the snapshot (live-only diff = []); the earlier "7" was a transient pre-cron check. All-clear state is correct today. Has-new UI state verified deterministically via dev-only ?demoNew flag (screenshot: 8-count badge, New pills, show-all toggle, caveat all render correctly); flag is inert in production (NODE_ENV guard)

## Follow-up 3: remove CSV export

- [x] Remove "Export current view" CSV download button + related export code from the dashboard (button, exportData fn, unused imports, CSS rules incl. mobile; tsc clean, 21 tests passing, screenshot verified)
- [ ] Checkpoint + push to GitHub manus-app branch
