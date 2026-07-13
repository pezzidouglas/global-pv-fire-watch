import json

path = "shared/data/research-sources.json"
data = json.load(open(path))
existing = {x.get("id") for x in data}

new_sources = [
    {
        "id": "italy-cnvvf-2015-2024",
        "jurisdiction": "Italy",
        "period": "2015\u20132024",
        "count": None,
        "confirmedPvOrigin": None,
        "metric": "PV-panel fire incidents in the national fire brigade statistical database; roughly 5\u201313 fires per GW installed annually",
        "sourceClass": "Official national incident statistics",
        "sourceTitle": "CNVVF statistical database, analysed in Rus et al. 2025 (J. Phys.: Conf. Ser. 3121 012050)",
        "sourceUrl": "https://iopscience.iop.org/article/10.1088/1742-6596/3121/1/012050",
        "windowRelation": "within-window",
        "caveat": "A dedicated \u201cPhotovoltaic Panels\u201d category exists since 2014. Counts reflect incidents where PV modules were involved in the fire, not proof that PV caused it. Earlier surveys recorded roughly 2,500 PV-related incidents across ~550,000 systems for 2002\u20132015.",
        "yearly": None,
    },
    {
        "id": "slovenia-urszr-2023-2024",
        "jurisdiction": "Slovenia",
        "period": "May 2023\u2013Jul 2024",
        "count": None,
        "confirmedPvOrigin": None,
        "metric": "PV-related fire deployments reported to the 112 emergency system; roughly 37 fires per GW installed annually",
        "sourceClass": "Official national incident statistics",
        "sourceTitle": "URSZR incident reporting, analysed in Rus et al. 2025 (J. Phys.: Conf. Ser. 3121 012050)",
        "sourceUrl": "https://iopscience.iop.org/article/10.1088/1742-6596/3121/1/012050",
        "windowRelation": "within-window",
        "caveat": "A PV-related category was only added to the reporting form in mid-2023, so the observation window is short and annual figures are extrapolated. Inclusion criteria may capture fires where a PV system was present but not the ignition source.",
        "yearly": None,
    },
    {
        "id": "international-benchmark-29-per-gw",
        "jurisdiction": "International (AU, DE, IT, US)",
        "period": "Multi-year, harmonised",
        "count": None,
        "confirmedPvOrigin": None,
        "metric": "Weighted international average of ~29 PV-related fires per GW of installed capacity per year",
        "sourceClass": "Peer-reviewed comparative research",
        "sourceTitle": "Four-country comparative study, reaffirmed in Rus et al. 2025 (J. Phys.: Conf. Ser. 3121 012050)",
        "sourceUrl": "https://iopscience.iop.org/article/10.1088/1742-6596/3121/1/012050",
        "windowRelation": "context-benchmark",
        "caveat": "National methodologies differ substantially and had to be harmonised; the benchmark expresses reporting frequency relative to installed capacity, not comparative safety of products or installers.",
        "yearly": None,
    },
]

added = [s for s in new_sources if s["id"] not in existing]
data.extend(added)
json.dump(data, open(path, "w"), indent=2, ensure_ascii=False)
print(f"added {len(added)}; total {len(data)}")
