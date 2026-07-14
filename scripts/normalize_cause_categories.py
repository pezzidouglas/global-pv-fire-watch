#!/usr/bin/env python3
"""Consolidate causeCategory labels in incidents.json into a consistent taxonomy.

Fixes lowercase entries and merges near-duplicate labels introduced by the
follow-up 8 merge while preserving the semantic distinction between confirmed
and suspected attributions.
"""
import json
from collections import Counter

PATH = "/home/ubuntu/pv-fire-watch/shared/data/incidents.json"

MAP = {
    "electrical": "Electrical fault suspected",
    "Electrical event": "Electrical fault",
    "Electrical failure": "Electrical fault",
    "Electrical arcing / failure": "Electrical fault",
    "Electrical issue suspected": "Electrical fault suspected",
    "Electrical fault / User error": "Electrical fault",
    "Equipment fault": "Equipment failure",
    "Equipment malfunction": "Equipment failure",
    "Panel fault": "Component defect suspected",
    "Inverter fault": "Inverter / PCS fault",
    "Inverter/PCS fault": "Inverter / PCS fault",
    "Transformer failure": "Transformer fault",
    "Overheating": "Overheating suspected",
    "Overheating / Weather": "Environmental / weather suspected",
    "Extreme weather": "Environmental / weather suspected",
    "Arson / vehicle fire": "Arson",
    "Arson suspected": "Arson suspected",
    "Solar-system event, unspecified": "Undetermined - PV involved",
    "Testing / maintenance": "Installation / maintenance alleged",
}

incidents = json.load(open(PATH))
changed = 0
for i in incidents:
    new = MAP.get(i["causeCategory"])
    if new and new != i["causeCategory"]:
        i["causeCategory"] = new
        changed += 1

json.dump(incidents, open(PATH, "w"), indent=1, ensure_ascii=False)
print(f"changed={changed}")
for k, v in sorted(Counter(i["causeCategory"] for i in incidents).items()):
    print(f"{v:3d}  {k}")
