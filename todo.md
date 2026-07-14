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
- [x] Checkpoint (0ed7cf58) + push to GitHub manus-app branch (0ed7cf5)

## Follow-up 4: list all incidents/reports in explorer

- [x] Replace 7-item "Latest reviewed incidents" preview with full list of reviewed incidents for current filter scope: rail renamed "Reviewed incidents" with record count, "Show all N incidents" click-to-load-more, scrollable expanded list; Reviewed register tab now uses date-desc full list
- [x] Show all vendor-indexed reports in the Index tab with load-more expansion (already present: "Show all N reports" toggle, confirmed)
- [x] Mobile responsiveness check for the expanded lists (390px verified; tsc clean, 21 tests passing)
- [x] Checkpoint (d9de6877) + push to GitHub manus-app branch (d9de687)

## Follow-up 5: research + add more documented PV fire events

- [x] Inspect current incidents dataset schema and existing IDs/coverage to avoid duplicates (48 reviewed incidents, 10 countries; schema + existing list saved to /home/ubuntu/research_inputs/dataset_reference.txt)
- [x] Parallel research: 16 regional scopes searched (fire brigades, national news, trade press); 79 candidate events returned
- [x] De-duplicate + validate: schema/enum/date>=2016/coords checks; rejected social-media & aggregator sources, battery/ESS-primary events, dupes; dropped mis-scoped Shanghai record; fixed umlaut slugs; URL spot-check 16/16 OK (report: /home/ubuntu/research_inputs/merge_report.txt)
- [x] Add verified new events: 48 -> 115 reviewed incidents (+67), 21 countries (11 new: Germany +9, Belgium, Switzerland, Portugal, Taiwan, South Korea, Singapore, Thailand, Brazil, Argentina, Cuba, Israel)
- [x] Verify map markers, country pages, trend chart, and counts update correctly (desktop + 390px screenshots; new country pages render)
- [x] Reconcile rendered hero counts vs data model (scripts/verify_counts.py): model = 115 reviewed / 122 indexed / 25 countries; hero shows 114 reviewed because the default 10-year filter excludes us-milpitas-walmart-2016 (Jun 2016), and 121 indexed because the live daily-check index has 1 fewer record than the snapshot (a removed 2022 French floating-solar article) — both differences are by-design filter/live-data behavior, no mismatch. Trend series sums to 115 = reviewed count OK
- [x] tsc + tests + mobile check (tsc clean, 21 tests passing, 390px verified)
- [x] Checkpoint (f2a5295b) + push to GitHub manus-app branch (f2a5295)

## Follow-up 6: easier return to global view after country selection

- [x] Floating "Back to global view" reset chip overlaid on the map when a country is selected (verified in browser: click resets to global)
- [x] Click empty map space (ocean/background) to reset to global (background rect click handler + "Click to return to global view" title)
- [x] Escape key resets country selection (skips when drawer/sheet open) — Playwright-verified: Germany selected → Escape → "212 provisional events in Global" restored
- [x] Selected-country state clearly visible: clickable "Global coverage" breadcrumb + amber "× Back to global" chip next to it; coverage strip shows detail-page link + back button
- [x] Mobile: verified at 390px with Germany actively selected — screenshot shows amber "× BACK TO GLOBAL" breadcrumb chip and floating "Back to global view" chip over the map, both visible and tappable
- [x] Verify (browser click-through: Germany select → chip click → global restored), tsc clean, 21 tests passing
- [x] Checkpoint (89d61792) + push to GitHub manus-app branch (89d6179)

## Follow-up 7: interactive timeline slider below the map

- [ ] Timeline slider component below the map: dual-handle range (start/end) over the full data span (2016–present) with year/month tick marks and a mini event-density histogram
- [ ] Wire slider to the existing date filtering so map markers, bubbles, incident lists, and counts update live
- [ ] Keep slider in sync with the existing date-range dropdown (10 years / custom presets)
- [ ] Match dark mission-control styling (amber accents, glassy track, glow handles); keyboard-accessible handles
- [ ] Mobile 390px check: touch-friendly handles, layout intact
- [ ] tsc + tests, checkpoint, push to GitHub manus-app branch
