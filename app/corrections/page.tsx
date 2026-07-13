import type { Metadata } from "next";
import InfoShell from "../info-shell";

export const metadata: Metadata = {
  title: "Corrections",
  description: "Request a correction, source update or takedown review for a PV Fire Watch record.",
  alternates: { canonical: "/corrections" },
};

export default function CorrectionsPage() {
  return (
    <InfoShell
      eyebrow="Corrections and takedown review"
      title="Every record can be challenged."
      intro="If a source is wrong, a duplicate was missed, a PV relationship changed after investigation, or publication creates a legitimate safety or privacy concern, request an editorial review."
    >
      <section className="policy-callout">
        <p>Use the contact form at <a href="https://www.greenwatts.solar/" target="_blank" rel="noreferrer">GreenWatts<span className="sr-only"> (opens in a new tab)</span></a>. Include “PV Fire Watch correction,” the record ID, the requested change and a public supporting source.</p>
      </section>
      <section>
        <h2>Review process</h2>
        <ul>
          <li>Source corrections are checked against the original publisher, authority or a stronger public source.</li>
          <li>Duplicate reports are grouped under one provisional event identifier.</li>
          <li>Cause language is revised when a later investigation changes or withdraws an earlier finding.</li>
          <li>Broken links are replaced with an authoritative equivalent where available.</li>
          <li>Takedown requests are assessed for accuracy, public interest, privacy and safety; factual public-interest records are normally corrected rather than silently removed.</li>
        </ul>
      </section>
      <section>
        <h2>What to send</h2>
        <p>Provide the record ID shown in the data export, the current statement, the proposed correction, a public source supporting the request and any time sensitivity. Do not send confidential, personal or legally privileged material through the public contact form.</p>
      </section>
    </InfoShell>
  );
}
