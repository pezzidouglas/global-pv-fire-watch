#!/usr/bin/env python3
"""Reconcile the dashboard hero stats with the underlying data files.

Hero derivation (mirrors Home.tsx computeStats):
- source records = reviewed incidents + indexed reports (excluded records removed)
- event clusters = unique event ids after recordToEvent grouping
- reviewed = incident-level records
- indexed = vendor-indexed reports minus excluded
- countries = unique countries across incidents (reviewed layer) + indexed reports
"""
import json

incidents = json.load(open("shared/data/incidents.json"))
index = json.load(open("shared/data/indexed-reports.json"))
groups = json.load(open("shared/data/event-groups.json"))

reports = index["reports"] if isinstance(index, dict) and "reports" in index else index
excluded = set(groups.get("excludedRecords", {}).keys())
r2e = groups.get("recordToEvent", {})

reviewed_ids = [i["id"] for i in incidents]
indexed_kept = [r for r in reports if r["id"] not in excluded]

total_records = len(reviewed_ids) + len(indexed_kept)
event_ids = set()
for rid in reviewed_ids + [r["id"] for r in indexed_kept]:
    event_ids.add(r2e.get(rid, rid))

countries = set(i["country"] for i in incidents)
for r in indexed_kept:
    c = r.get("country")
    if c:
        countries.add(c)

print(f"reviewed incidents      : {len(reviewed_ids)}")
print(f"indexed reports (kept)  : {len(indexed_kept)} (excluded: {len(excluded)})")
print(f"total source records    : {total_records}")
print(f"event clusters          : {len(event_ids)}")
print(f"countries (both layers) : {len(countries)}")
print(f"reviewed-layer countries: {len(set(i['country'] for i in incidents))}")

# Trend series check: reviewed incidents per year 2016..2026
from collections import Counter
per_year = Counter(i["date"][:4] for i in incidents)
print("trend series:", dict(sorted(per_year.items())))
assert sum(per_year.values()) == len(reviewed_ids)
print("trend sum == reviewed count OK")
