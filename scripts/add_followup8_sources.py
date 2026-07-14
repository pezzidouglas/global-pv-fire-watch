#!/usr/bin/env python3
"""Append curated follow-up 8 aggregate research sources to research-sources.json.

Selection rationale (from 27 candidates):
- Kept: primary-document or established-outlet sources adding NEW jurisdictions
  (Denmark BRS, Sweden, Poland KG PSP, Czechia HZS, Japan NITE 10-year, South Korea
  NFA, New Zealand FENZ OIA, Victoria Energy Safe, Lower Austria, France ARIA,
  UK QBE 2024 breakdown via planning inspectorate, CEA global audit, kWh Analytics 2026,
  IEA PVPS PVFS 2025).
- Dropped: duplicates of existing sources (Fraunhofer 350, Japan CSIC 2008-2017,
  UK QBE 2022-2024 total), weak/secondary blogs (EDF marketing page, castles.com.ng,
  revistajaraysedal citing ABC), Austria KFV (count is installed base not fires),
  Allianz (qualitative), Changhua County (too narrow, kept as incidents instead),
  Korea ESS-only chosun (BESS scope), pv-magazine restating kWh Analytics.
"""
import json

PATH = "/home/ubuntu/pv-fire-watch/shared/data/research-sources.json"

NEW_SOURCES = [
    {
        "id": "denmark-brs-2020-2025",
        "jurisdiction": "Denmark",
        "period": "2020\u2013H1 2025",
        "count": 190,
        "confirmedPvOrigin": None,
        "metric": "Emergency-response incidents involving PV systems recorded by Beredskabsstyrelsen",
        "sourceClass": "Official national incident statistics",
        "sourceTitle": "Beredskabsstyrelsen: Flere solcelleanl\u00e6g betyder ikke n\u00f8dvendigvis flere brande",
        "sourceUrl": "https://www.brs.dk/da/nyheder/2025/flere-solcelleanlag-betyder-ikke-nodvendigvis-flere-brande/",
        "windowRelation": "within-window",
        "caveat": "Incident involvement of a PV system does not establish the PV system as the ignition source; the agency notes fire counts have not grown in step with installations."
    },
    {
        "id": "sweden-msb-2018-2024",
        "jurisdiction": "Sweden",
        "period": "2018\u20132024",
        "count": 155,
        "confirmedPvOrigin": None,
        "metric": "Fires and fire incidents linked to solar-cell installations in rescue-service incident reports",
        "sourceClass": "Fire-service incident statistics",
        "sourceTitle": "Statistik om br\u00e4nder i solcellsanl\u00e4ggningar (Swedish rescue-service data compilation)",
        "sourceUrl": "https://www.utkiken.net/solceller/77813-statistik-om-br%C3%A4nder-i-solcellsanl%C3%A4ggningar",
        "windowRelation": "within-window",
        "caveat": "Compiled from MSB incident-report free text; classification of PV as cause versus involvement varies across municipal rescue services."
    },
    {
        "id": "poland-kgpsp-2024-2026",
        "jurisdiction": "Poland",
        "period": "2024\u2013Q1 2026",
        "count": 1676,
        "confirmedPvOrigin": None,
        "metric": "Fires in buildings or facilities with PV installations recorded by the State Fire Service (KG PSP): 808 in 2024, 759 in 2025 (to 10 Nov), 109 in Q1 2026",
        "sourceClass": "Official national fire-service statistics",
        "sourceTitle": "KG PSP data reported by Gram w Zielone: Po\u017cary fotowoltaiki",
        "sourceUrl": "https://www.gramwzielone.pl/energia-sloneczna/20366952/pozar-fotowoltaiki-na-dolnym-slasku-strazacy-nie-mogli-odlaczyc-instalacji",
        "windowRelation": "within-window",
        "caveat": "Counts are fires in objects where a PV installation was present, not necessarily fires ignited by the PV system."
    },
    {
        "id": "czechia-hzs-2015-2024",
        "jurisdiction": "Czechia",
        "period": "2015\u20132024",
        "count": 167,
        "confirmedPvOrigin": 59,
        "metric": "Fires involving PV power plants recorded by the Czech fire service (HZS \u010cR); 83 in 2024 alone, of which 59 caused by the PV system",
        "sourceClass": "Official national fire-service statistics",
        "sourceTitle": "HZS \u010cR data reported by Novinky.cz: V \u010cesku v\u00fdrazn\u011b roste po\u010det po\u017e\u00e1r\u016f fotovoltaick\u00fdch elektr\u00e1ren",
        "sourceUrl": "https://www.novinky.cz/clanek/krimi-v-cesku-vyrazne-roste-pocet-pozaru-fotovoltaickych-elektraren-mohou-za-to-i-lonske-povodne-40510124",
        "windowRelation": "within-window",
        "caveat": "confirmedPvOrigin figure applies to 2024 only; earlier-year cause attribution is not broken out in the report."
    },
    {
        "id": "japan-nite-2015-2024",
        "jurisdiction": "Japan",
        "period": "FY2015\u2013FY2024",
        "count": 260,
        "confirmedPvOrigin": 239,
        "metric": "Accidents involving solar power generation equipment reported to NITE over 10 years; about 90% (239) were fires, with power conditioners (170 cases) the leading component",
        "sourceClass": "Official product-safety statistics",
        "sourceTitle": "NITE mail magazine Vol.487: \u592a\u967d\u5149\u767a\u96fb\u8a2d\u5099\u306e\u4e8b\u6545",
        "sourceUrl": "https://www.nite.go.jp/jiko/chuikanki/mailmagazin/2025fy/vol487_251028.html",
        "windowRelation": "within-window",
        "caveat": "NITE receives reports on consumer-product accidents; utility-scale plant fires outside the reporting scheme are not captured."
    },
    {
        "id": "south-korea-nfa-2019-2023",
        "jurisdiction": "South Korea",
        "period": "2019\u20132023",
        "count": 472,
        "confirmedPvOrigin": None,
        "metric": "PV-related fires recorded by the National Fire Agency: 62 (2019), 69 (2020), 81 (2021), 99 (2022), 124 (2023); ~7 in 10 attributed to electrical factors",
        "sourceClass": "Official national fire-service statistics",
        "sourceTitle": "National Fire Agency data reported by Newsis: \ucd5c\uadfc 5\ub144 \ud0dc\uc591\uad11 \ud654\uc7ac 44\uc5b5 \ud53c\ud574",
        "sourceUrl": "https://mobile.newsis.com/view_amp.html?ar_id=NISX20231006_0002474575",
        "windowRelation": "within-window",
        "caveat": "Aggregate includes fires at PV facilities of all scales; electrical-factor attribution does not distinguish module, inverter, or wiring origin."
    },
    {
        "id": "new-zealand-fenz-2020-2025",
        "jurisdiction": "New Zealand",
        "period": "FY2020\u2013FY2025",
        "count": 2,
        "confirmedPvOrigin": None,
        "metric": "Solar-panel structure fires in Fire and Emergency NZ callout data released under the Official Information Act",
        "sourceClass": "Official information release",
        "sourceTitle": "FENZ OIA response 19266: Callout data for solar-related fires",
        "sourceUrl": "https://www.fireandemergency.nz/assets/Documents/OIA-responses/OIA19266-Callout-data-for-solar-related-fires.pdf",
        "windowRelation": "within-window",
        "caveat": "Callout coding relies on attending crews recording solar involvement; low counts partly reflect NZ's small installed base."
    },
    {
        "id": "victoria-esv-2021-2023",
        "jurisdiction": "Victoria, Australia",
        "period": "FY2021\u201322\u2013FY2022\u201323",
        "count": 82,
        "confirmedPvOrigin": None,
        "metric": "Solar panel-related fires reported to Energy Safe Victoria: 27 (2021\u201322) rising to 55 (2022\u201323); DC-isolator fires rose from 15 to 41",
        "sourceClass": "Official energy-safety regulator statistics",
        "sourceTitle": "ABC News: Solar panel fires increase prompts DC isolator warning",
        "sourceUrl": "https://www.abc.net.au/news/2023-09-14/solar-panel-fires-increase-dc-isolator-nt-worksafe-warning/102843552",
        "windowRelation": "within-window",
        "caveat": "Complements the CFA/MFB brigade series already tracked; regulator reporting captures notified electrical incidents rather than all brigade callouts."
    },
    {
        "id": "lower-austria-bv-2019-2025",
        "jurisdiction": "Lower Austria, Austria",
        "period": "2019\u20132025",
        "count": 27,
        "confirmedPvOrigin": None,
        "metric": "Documented fire cases involving PV systems out of roughly 145,000 installed systems in the province",
        "sourceClass": "Provincial fire-prevention authority",
        "sourceTitle": "ORF Nieder\u00f6sterreich: PV-Anlagen \u2013 Montagem\u00e4ngel als Brandrisiko (Landesstelle f\u00fcr Brandverh\u00fctung)",
        "sourceUrl": "https://noe.orf.at/stories/3319472/",
        "windowRelation": "within-window",
        "caveat": "The fire-prevention office highlights installation defects as the dominant cause; only investigated cases are counted."
    },
    {
        "id": "france-aria-2002-2016",
        "jurisdiction": "France",
        "period": "2002\u20132016",
        "count": 53,
        "confirmedPvOrigin": None,
        "metric": "Incidents involving photovoltaic panels recorded in the national ARIA industrial-accident database",
        "sourceClass": "Official accident database study",
        "sourceTitle": "Minist\u00e8re de la Transition \u00e9cologique, base ARIA: Accidentologie photovolta\u00efque",
        "sourceUrl": "https://www.aria.developpement-durable.gouv.fr/wp-content/uploads/2016/02/2016-02-18-SY-Photovoltaique.pdf",
        "windowRelation": "pre-window",
        "caveat": "ARIA covers classified installations and notable accidents, so small residential fires are under-represented; period predates the 2016+ incident window."
    },
    {
        "id": "uk-qbe-2024-breakdown",
        "jurisdiction": "United Kingdom",
        "period": "2024",
        "count": 151,
        "confirmedPvOrigin": None,
        "metric": "Solar-panel fires attended in 2024 across 37 of 49 fire services: 97 residential, 27 commercial, 17 solar farms (QBE FOI, submitted in planning evidence)",
        "sourceClass": "Insurer FOI data in planning evidence",
        "sourceTitle": "Planning Inspectorate submission EN010170: Fire Hazard and BESS installation proposals at Grendon",
        "sourceUrl": "https://nsip-documents.planninginspectorate.gov.uk/published-documents/EN010170-001692-Fire%20Hazard%20and%20BESS%20installation%20proposals%20at%20Grendon.pdf",
        "windowRelation": "within-window",
        "caveat": "Extends the QBE 2022\u20132024 series already tracked with a property-type breakdown for 2024; 12 fire services did not respond to the FOI."
    },
    {
        "id": "cea-global-rooftop-audit-2023",
        "jurisdiction": "Global (rooftop C&I audits)",
        "period": "to 2023",
        "count": 600,
        "confirmedPvOrigin": None,
        "metric": "Rooftop PV systems audited worldwide; 97% showed at least one major fire or electrical safety concern (49% grounding issues, 47% cross-mated connectors)",
        "sourceClass": "Independent engineering audit",
        "sourceTitle": "Clean Energy Associates: Top 10 PV Rooftop Safety Risks",
        "sourceUrl": "https://info.cea3.com/hubfs/PV%20Solar%20Safety%20Risks/CEA-Top%2010%20PV%20Rooftop%20Safety%20Risks.pdf",
        "windowRelation": "within-window",
        "caveat": "Audit sample skews to commercial and industrial rooftops whose owners commissioned inspections; findings are risk indicators, not fire counts."
    },
    {
        "id": "kwh-analytics-sra-2026",
        "jurisdiction": "United States (utility-scale)",
        "period": "2026 report",
        "count": None,
        "confirmedPvOrigin": None,
        "metric": "Fire identified as the second-largest loss driver at PV sites; 84% of PV fire events are equipment-driven brushfires originating within the plant",
        "sourceClass": "Insurance industry analysis",
        "sourceTitle": "kWh Analytics: 2026 Solar Risk Assessment",
        "sourceUrl": "https://kwhanalytics.com/industry-reports/2026-solar-risk-assessment/",
        "windowRelation": "within-window",
        "caveat": "Based on insured-loss and claims data for utility-scale assets; percentages describe loss events, not a census of all fires."
    },
    {
        "id": "iea-pvps-pvfs-2025",
        "jurisdiction": "International (IEA PVPS members)",
        "period": "2025 report",
        "count": None,
        "confirmedPvOrigin": None,
        "metric": "Photovoltaic Failure Fact Sheets cataloguing module and system failure modes, including those with fire consequences, from Task 13 field data",
        "sourceClass": "International research programme",
        "sourceTitle": "IEA PVPS Task 13: Photovoltaic Failure Fact Sheets (PVFS) 2025",
        "sourceUrl": "https://iea-pvps.org/wp-content/uploads/2025/02/IEA-PVPS-T13-30-2025-PVFS-ANNEX-Degradation-and-Failure.pdf",
        "windowRelation": "within-window",
        "caveat": "A failure-mode taxonomy rather than an incident census; fire-relevant failures are a subset of documented degradation modes."
    }
]

def main():
    sources = json.load(open(PATH))
    existing_ids = {s.get("id") for s in sources}
    added = 0
    for s in NEW_SOURCES:
        if s["id"] in existing_ids:
            print("skip (exists):", s["id"])
            continue
        sources.append(s)
        added += 1
    json.dump(sources, open(PATH, "w"), indent=1, ensure_ascii=False)
    print(f"added={added} total={len(sources)}")

if __name__ == "__main__":
    main()
