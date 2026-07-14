#!/usr/bin/env python3
"""Validate, de-duplicate, and merge researched PV fire events into incidents.json.

Reads /home/ubuntu/find_pv_fire_events.json (map results), validates each event
against the incident schema, drops duplicates (against existing incidents and
within the new batch), and writes the merged incidents.json plus a report.
"""
import json
import re
import sys
from datetime import date

RESULTS = "/home/ubuntu/find_pv_fire_events.json"
INCIDENTS = "shared/data/incidents.json"
REPORT = "/home/ubuntu/research_inputs/merge_report.txt"

VALID = {
    "datePrecision": {"day", "month", "year"},
    "assetType": {"rooftop", "utility"},
    "severity": {"minor", "moderate", "major"},
    "status": {"verified", "reported"},
    "pvRole": {"confirmed", "suspected", "involved"},
    "region": {"North America", "Europe", "Asia-Pacific", "Latin America", "Middle East & Africa"},
    "sourceType": {"news-report", "fire-service-report", "official-statement", "court-filing", "research-report"},
}
REQUIRED = [
    "title", "date", "datePrecision", "city", "country", "region", "lat", "lng",
    "assetType", "propertyType", "severity", "status", "pvRole", "causeCategory",
    "cause", "sourceTitle", "sourceUrl", "sourceType", "summary", "locationPrecision",
]

ISO2 = {
    "germany": "de", "netherlands": "nl", "belgium": "be", "united kingdom": "uk",
    "ireland": "ie", "france": "fr", "switzerland": "ch", "italy": "it", "spain": "es",
    "portugal": "pt", "australia": "au", "new zealand": "nz", "japan": "jp",
    "south korea": "kr", "taiwan": "tw", "china": "cn", "india": "in",
    "singapore": "sg", "thailand": "th", "vietnam": "vn", "malaysia": "my",
    "philippines": "ph", "united states": "us", "canada": "ca", "mexico": "mx",
    "brazil": "br", "chile": "cl", "argentina": "ar", "colombia": "co",
    "panama": "pa", "united arab emirates": "ae", "saudi arabia": "sa",
    "israel": "il", "jordan": "jo", "south africa": "za", "kenya": "ke",
    "nigeria": "ng", "austria": "at", "poland": "pl", "czech republic": "cz",
    "denmark": "dk", "sweden": "se", "norway": "no", "finland": "fi",
    "greece": "gr", "turkey": "tr", "puerto rico": "pr", "dominican republic": "do",
}


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s


def make_id(ev, existing_ids):
    cc = ISO2.get(ev["country"].lower(), slugify(ev["country"])[:2])
    city = slugify(ev["city"].split(",")[0])[:28]
    year = ev["date"][:4]
    base = f"{cc}-{city}-{year}"
    cand, n = base, 2
    while cand in existing_ids:
        cand = f"{base}-{n}"
        n += 1
    return cand


def norm_key(ev):
    return (ev["date"][:7], slugify(ev["city"].split(",")[0]), ev["country"].lower())


def main():
    results = json.load(open(RESULTS))["results"]
    incidents = json.load(open(INCIDENTS))
    existing_ids = {i["id"] for i in incidents}
    existing_keys = {norm_key(i) for i in incidents}
    existing_urls = {i.get("sourceUrl", "").rstrip("/") for i in incidents}

    today = date.today().isoformat()
    accepted, rejected = [], []

    for r in results:
        out = r.get("output") or {}
        scope = out.get("scope", r.get("input", "?"))
        try:
            events = json.loads(out.get("events_json") or "[]")
        except json.JSONDecodeError as e:
            rejected.append((scope, "ALL", f"events_json parse error: {e}"))
            continue
        if not isinstance(events, list):
            rejected.append((scope, "ALL", "events_json not a list"))
            continue
        for ev in events:
            label = f"{ev.get('date','?')} {ev.get('city','?')} ({ev.get('country','?')})"
            # required fields
            missing = [k for k in REQUIRED if not ev.get(k)]
            if missing:
                rejected.append((scope, label, f"missing fields: {missing}"))
                continue
            # enum validation
            bad = [k for k, allowed in VALID.items() if ev.get(k) not in allowed]
            if bad:
                rejected.append((scope, label, f"invalid enum values: {[(k, ev.get(k)) for k in bad]}"))
                continue
            # date sanity (tracker covers 2016+)
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", ev["date"]) or not ("2016-01-01" <= ev["date"] <= today):
                rejected.append((scope, label, f"date out of range {ev['date']}"))
                continue
            # source quality: no social-media or aggregator-only sources
            low_quality = ("facebook.com", "newsbreak.com", "twitter.com", "x.com/", "instagram.com", "tiktok.com")
            if any(d in ev["sourceUrl"].lower() for d in low_quality):
                rejected.append((scope, label, "low-quality source (social media/aggregator)"))
                continue
            # battery/ESS-primary events are out of scope (PV must be the involved asset)
            title_l = ev["title"].lower()
            if "ess fire" in title_l or "battery fire" in title_l or "battery" in title_l.split(" fire")[0].split()[-1:]:
                rejected.append((scope, label, "battery/ESS-primary event out of scope"))
                continue
            # coords sanity
            try:
                lat, lng = float(ev["lat"]), float(ev["lng"])
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    raise ValueError
            except (ValueError, TypeError):
                rejected.append((scope, label, "bad coordinates"))
                continue
            # URL sanity
            if not ev["sourceUrl"].startswith("http"):
                rejected.append((scope, label, "bad source URL"))
                continue
            # dedup vs existing and batch
            key = norm_key(ev)
            if key in existing_keys:
                rejected.append((scope, label, "duplicate (date+city+country)"))
                continue
            if ev["sourceUrl"].rstrip("/") in existing_urls:
                rejected.append((scope, label, "duplicate source URL"))
                continue
            new_id = make_id(ev, existing_ids)
            record = {
                "id": new_id,
                "date": ev["date"],
                "datePrecision": ev["datePrecision"],
                "title": ev["title"],
                "city": ev["city"],
                "country": ev["country"],
                "region": ev["region"],
                "lat": round(lat, 4),
                "lng": round(lng, 4),
                "assetType": ev["assetType"],
                "propertyType": ev["propertyType"],
                "severity": ev["severity"],
                "status": ev["status"],
                "pvRole": ev["pvRole"],
                "causeCategory": ev["causeCategory"],
                "cause": ev["cause"],
                "sourceTitle": ev["sourceTitle"],
                "sourceUrl": ev["sourceUrl"],
                "sourceType": ev["sourceType"],
                "summary": ev["summary"],
                "injuries": ev.get("injuries"),
                "lossUsd": ev.get("lossUsd"),
                "locationPrecision": "approximate-city-or-site",
            }
            existing_ids.add(new_id)
            existing_keys.add(key)
            existing_urls.add(ev["sourceUrl"].rstrip("/"))
            accepted.append((scope, record))

    lines = [f"ACCEPTED: {len(accepted)}  REJECTED: {len(rejected)}", ""]
    for scope, rec in accepted:
        lines.append(f"+ {rec['id']} | {rec['date']} | {rec['country']} | {rec['title']} | {rec['sourceUrl']} [{scope}]")
    lines.append("")
    for scope, label, reason in rejected:
        lines.append(f"- {label}: {reason} [{scope}]")
    open(REPORT, "w").write("\n".join(lines))
    print("\n".join(lines[:6]))

    if "--write" in sys.argv:
        merged = incidents + [rec for _, rec in accepted]
        merged.sort(key=lambda i: i["date"])
        json.dump(merged, open(INCIDENTS, "w"), indent=1, ensure_ascii=False)
        print(f"WROTE {INCIDENTS}: {len(incidents)} -> {len(merged)} incidents")


if __name__ == "__main__":
    main()
