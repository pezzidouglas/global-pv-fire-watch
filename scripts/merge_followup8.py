#!/usr/bin/env python3
"""Merge curated follow-up 8 incidents into shared/data/incidents.json.

Maps research output fields onto the incident schema used by the dashboard,
generates ids with the established cc-city-year pattern, normalizes sourceType
and region values to those already used, and appends sorted by date.
"""
import json
import re

CURATED = "/home/ubuntu/research_inputs/followup8_final_incidents.json"
INCIDENTS = "/home/ubuntu/pv-fire-watch/shared/data/incidents.json"
REPORT = "/home/ubuntu/research_inputs/followup8_merge_report.txt"

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
    "czechia": "cz", "denmark": "dk", "sweden": "se", "norway": "no", "finland": "fi",
    "greece": "gr", "turkey": "tr", "puerto rico": "pr", "dominican republic": "do",
    "hungary": "hu", "romania": "ro", "bulgaria": "bg", "slovakia": "sk",
    "luxembourg": "lu", "kuwait": "kw", "indonesia": "id", "slovenia": "si",
}

SOURCE_TYPE_MAP = {
    "news": "news-report", "local-news": "news-report", "news-report": "news-report",
    "trade-press": "trade-press", "fire-service-report": "fire-service-report",
    "fire-service": "fire-service-report", "fire-authority": "fire-service-report",
    "fire-service-press": "fire-service-report", "official-statement": "official-statement",
    "court-filing": "court-filing", "peer-reviewed": "peer-reviewed",
    "research-report": "research-report", "official": "official-statement",
}

# Countries whose canonical macro-region in the dataset differs from raw values
REGION_MAP = {
    "sweden": "Europe", "norway": "Europe", "finland": "Europe", "denmark": "Europe",
    "poland": "Europe", "czechia": "Europe", "slovakia": "Europe", "hungary": "Europe",
    "romania": "Europe", "bulgaria": "Europe", "austria": "Europe", "greece": "Europe",
    "switzerland": "Europe", "luxembourg": "Europe", "turkey": "Middle East & Africa",
    "south africa": "Middle East & Africa", "kuwait": "Middle East & Africa",
    "israel": "Middle East & Africa", "canada": "North America", "mexico": "Latin America",
    "japan": "Asia-Pacific", "south korea": "Asia-Pacific", "taiwan": "Asia-Pacific",
    "china": "Asia-Pacific", "vietnam": "Asia-Pacific", "india": "Asia-Pacific",
    "indonesia": "Asia-Pacific",
}

def slugify(text):
    text = re.sub(r"[^\x00-\x7f]", "", text)  # ascii only, matches existing slugs
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

def main():
    curated = json.load(open(CURATED))
    incidents = json.load(open(INCIDENTS))
    existing_ids = {i["id"] for i in incidents}
    # Fingerprints of existing incidents for a final dedup safety net
    fp = {(i["country"].lower(), i["date"][:7], slugify(i["city"])[:20]) for i in incidents}

    added, skipped = [], []
    for ev in curated:
        country_l = ev["country"].strip().lower()
        cc = ISO2.get(country_l, slugify(ev["country"])[:2])
        city_slug = slugify(ev["city"].split(",")[0])[:28] or "unknown"
        f = (country_l, ev["date"][:7], city_slug[:20])
        if f in fp:
            skipped.append((ev["title"], "fingerprint dup at merge"))
            continue
        fp.add(f)
        base = f"{cc}-{city_slug}-{ev['date'][:4]}"
        new_id, n = base, 2
        while new_id in existing_ids:
            new_id = f"{base}-{n}"
            n += 1
        existing_ids.add(new_id)

        region = REGION_MAP.get(country_l, ev["region"])
        stype = SOURCE_TYPE_MAP.get(ev.get("sourceType", "news"), "news-report")
        rec = {
            "id": new_id,
            "date": ev["date"],
            "datePrecision": ev.get("datePrecision", "day"),
            "title": ev["title"],
            "city": ev["city"],
            "country": ev["country"].strip(),
            "region": region,
            "lat": round(float(ev["lat"]), 4),
            "lng": round(float(ev["lng"]), 4),
            "assetType": ev["assetType"],
            "propertyType": ev["propertyType"][:60],
            "severity": ev["severity"],
            "status": ev["status"],
            "pvRole": ev["pvRole"],
            "causeCategory": ev["causeCategory"],
            "cause": ev["cause"],
            "sourceTitle": ev["sourceTitle"],
            "sourceUrl": ev["sourceUrl"],
            "sourceType": stype,
            "summary": ev["summary"],
            "injuries": int(ev.get("injuries") or 0),
            "lossUsd": None,
            "locationPrecision": "city",
        }
        incidents.append(rec)
        added.append(new_id)

    incidents.sort(key=lambda x: x["date"])
    json.dump(incidents, open(INCIDENTS, "w"), indent=1, ensure_ascii=False)

    with open(REPORT, "w") as f:
        f.write(f"ADDED {len(added)} incidents; total now {len(incidents)}\n")
        for a in added:
            f.write(f"  + {a}\n")
        f.write(f"SKIPPED {len(skipped)}\n")
        for t, r in skipped:
            f.write(f"  - {t}: {r}\n")
    print(f"added={len(added)} skipped={len(skipped)} total={len(incidents)}")

if __name__ == "__main__":
    main()
