import type { Metadata } from "next";
import InfoShell from "../info-shell";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How Global PV Fire Watch discovers, reviews, groups and reports public PV-fire records.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return (
    <InfoShell
      eyebrow="Editorial protocol · version 2026-07"
      title="Transparent coverage, cautious conclusions."
      intro="Global PV Fire Watch is a public-source reporting index, not a complete global census of PV fires. Reviewed records are checked against incident-level sources; indexed records are discovery leads awaiting incident-level review. Counts measure documented reporting coverage—not fire frequency, probability or comparative risk."
    >
      <section className="policy-callout">
        <p>More than one article can describe the same fire. The dashboard therefore shows both source-record totals and provisional event clusters after known overlaps are grouped.</p>
      </section>
      <section>
        <h2>Evidence layers</h2>
        <h3>Reviewed records</h3>
        <p>Each reviewed record has an incident-level public source, a date, a country, a rooftop or utility-scale classification, and an approximate city or site point. “Source-reviewed” means an authority, technical investigation or corroborated reporting supports the incident and the stated PV relationship. It does not prove that PV caused the fire.</p>
        <h3>Vendor-indexed records</h3>
        <p>Additional reports are discovered through the ArcBox public incident index, a commercial fire-safety vendor resource. This layer is useful for breadth but carries geographic, language, commercial and editorial selection bias. It is kept at country level until incident-level review.</p>
        <h3>Aggregate research</h3>
        <p>Official, insurer and technical datasets use different definitions, territories and time periods. Their totals overlap and are never added to the incident register.</p>
      </section>
      <section>
        <h2>Inclusion and exclusion</h2>
        <p>Records must fall within the rolling ten-year window and describe a PV array, module, DC/AC balance-of-system component or solar-facility electrical component that burned, sparked or was credibly identified as a possible ignition source.</p>
        <ul>
          <li>Excluded: BESS-only or battery-only events with no PV involvement.</li>
          <li>Excluded: wildfires that only damage a solar installation, unless the facility is credibly reported as an ignition source.</li>
          <li>Excluded: safety guidance, recalls without a fire, laboratory tests, unsupported social posts and aggregate articles modeled as single incidents.</li>
          <li>Grouped: duplicate coverage and later follow-up articles about the same event.</li>
        </ul>
      </section>
      <section>
        <h2>Event grouping and uncertainty</h2>
        <p>Known overlaps are linked to a shared event identifier using place, time, facility and narrative matching. Untouched records default to their own event. Event counts are therefore provisional: undiscovered duplicates can remain, while one article can occasionally describe more than one fire. Month-only dates use the first day of the month for filtering, with the month precision retained in the interface.</p>
        <p>Map points are approximate city or site locations and should not be interpreted as parcel-level coordinates. Reported impact classes are editorial summaries: minor is localized component damage; moderate is limited array, roof or structure damage; major is substantial facility damage, evacuation or extended response; catastrophic indicates reported loss of life, mass casualty or near-total facility loss.</p>
      </section>
      <section>
        <h2>Daily refresh</h2>
        <p>The public index endpoint is rechecked on the first visit after its edge cache expires, with a maximum successful-cache age of 23 hours. Suspicious responses, unexpected content types, oversized payloads and contractions greater than 10% are quarantined; the last validated snapshot remains visible. Human-reviewed records change only after editorial review.</p>
        <p>A GitHub mirror can also run the daily discovery workflow at 14:17 UTC. That schedule becomes active only after this project is connected to an actual GitHub repository with Actions enabled.</p>
      </section>
      <section>
        <h2>What the dashboard cannot show</h2>
        <p>No global authority records every PV fire, and reporting intensity differs sharply by language and jurisdiction. The index has no defensible global denominator for installed systems, capacity, age, equipment type or reporting probability. It must not be used as a safety certification, legal finding, insurance opinion or cross-country risk ranking.</p>
      </section>
    </InfoShell>
  );
}
