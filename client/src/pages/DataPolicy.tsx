import InfoShell from "@/components/InfoShell";

export default function DataPolicy() {
  return (
    <InfoShell
      pageTitle="Data policy"
      eyebrow="Rights, privacy and use"
      title="Open metadata with clear boundaries."
      intro="The project publishes factual incident metadata and links to original public sources. It does not republish source articles, and a link does not imply endorsement by the publisher or by Global PV Fire Watch."
    >
      <section>
        <h2>Licensing</h2>
        <p>Project code is released under the MIT License. Project-authored factual metadata and original explanatory text are offered under CC BY 4.0 to the extent the project owns those materials. Third-party titles, quotations, linked articles, photographs, datasets, trademarks and other publisher material are excluded from that grant and remain subject to their owners&apos; terms.</p>
        <p>Indexed descriptions are project-authored neutral summaries generated from basic classification fields. Upstream article snippets are used only transiently for relevance screening and are not published as the project&apos;s text.</p>
      </section>
      <section>
        <h2>Privacy</h2>
        <p>The dashboard has no advertising cookies, user accounts or profiling. CSV exports are created in the visitor&apos;s browser. The hosting provider may process standard request logs and privacy-respecting aggregate visit counts for security and operations. External publishers apply their own privacy and cookie policies when a source link is opened.</p>
      </section>
      <section>
        <h2>Responsible use</h2>
        <p>This is a research and prevention tool. It is not a complete incident census, product ranking, safety certification, legal finding, insurance opinion or normalized risk rate. Users should inspect the linked evidence and seek qualified technical advice before making safety, underwriting, policy or legal decisions.</p>
      </section>
    </InfoShell>
  );
}
