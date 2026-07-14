#!/usr/bin/env python3
"""Post-merge fixups: the cn-shanghai-2021 event is actually a Maryland (US)
warehouse fire described by a Chinese loss adjuster — mis-scoped by research,
and the same Amazon/Maryland vicinity risks duplication with existing tracked
events; drop it. Also clean mangled umlaut slugs after the merge."""
import json

INCIDENTS = "shared/data/incidents.json"

items = json.load(open(INCIDENTS))
before = len(items)

# Drop the mis-attributed Shanghai record (fire actually in Maryland, USA;
# adjuster case study, not a China incident)
items = [i for i in items if i["id"] != "cn-shanghai-2021"]

# Clean slug mangling from non-ASCII city names
slug_fixes = {
    "de-mei-enheim-2025": "de-meissenheim-2025",
    "br-uberl-ndia-2026": "br-uberlandia-2026",
    "de-l-rrach-2021": "de-loerrach-2021",
    "es-t-as-2024": "es-tias-2024",
}
for i in items:
    if i["id"] in slug_fixes:
        i["id"] = slug_fixes[i["id"]]

json.dump(items, open(INCIDENTS, "w"), indent=1, ensure_ascii=False)
print(f"{before} -> {len(items)} incidents; slugs fixed: {sum(1 for i in items if i['id'] in slug_fixes.values())}")
