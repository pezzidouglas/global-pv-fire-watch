# Incident data protocol

The dashboard deliberately maintains four separate layers:

- `incidents.json`: reviewed, geolocated incident-level records.
- `indexed-reports.json`: additional public reports indexed by a third party and linked to their original source; not independently verified by this project.
- `research-sources.json`: official, insurer and technical evidence layers, including documented data gaps. Counts are not summed because periods, definitions and territories overlap.
- `candidates.json`: automated multilingual discovery queue awaiting human review.
- `pipeline-status.json`: last successful source check, content-change date, source health, and daily cadence metadata.
- `event-groups.json`: methodology version, known duplicate/follow-up links, and explicitly excluded non-incident records.

## Inclusion

- The incident occurred within the rolling ten-year window.
- A PV array, module, DC/AC balance-of-system component, or solar-facility electrical component burned, sparked, or was credibly identified as a possible ignition source.
- At least one publicly accessible source is retained.
- When only a year or month is known, `datePrecision` records that uncertainty. The rolling-window filter treats the stored period start conservatively.

## Exclusion

- Battery-only or BESS events with no PV involvement.
- Wildfires that merely damaged a solar installation unless the facility is credibly reported as an ignition source.
- Laboratory tests, recalls without a fire, duplicate coverage, and unsupported social posts.

## Evidence labels

- **Source-reviewed** (`verified` in the legacy data field): a fire authority, regulator, technical investigation, or independently corroborated high-quality report supports the incident and its stated PV relationship.
- **Publicly reported** (`reported` in the legacy data field): credible public reporting establishes that PV was involved, but the cause or final official finding is not available.

Allegations in a civil complaint remain **reported** unless independently established; a filing is a primary source for the allegation, not proof that the allegation is true.

Evidence status is not a legal conclusion about causation, fault, negligence or liability. Coordinates are approximate city or site points and are not parcel-level geocodes.

## Counts

The dashboard publishes two counts. **Source records** count every included reviewed or indexed record. **Provisional event clusters** apply the known mappings in `event-groups.json`, so duplicate and follow-up articles count once. Unrecognized duplicates can remain, and some aggregate reporting can describe multiple fires; event counts are therefore provisional.

The indexed layer is discovered through the ArcBox public incident index, a commercial fire-safety vendor resource. Its selection is not statistically representative and carries geographic, language, commercial and editorial bias.
