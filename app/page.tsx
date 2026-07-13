import Dashboard, { type DashboardProps } from "./dashboard";
import incidents from "@/data/incidents.json";
import candidates from "@/data/candidates.json";
import indexedReports from "@/data/indexed-reports.json";
import researchSources from "@/data/research-sources.json";
import pipelineStatus from "@/data/pipeline-status.json";
import eventGroups from "@/data/event-groups.json";

export default function Home() {
  return (
    <Dashboard
      initialIncidents={incidents as DashboardProps["initialIncidents"]}
      candidateCount={candidates.length}
      indexedReports={indexedReports as DashboardProps["indexedReports"]}
      researchSources={researchSources as DashboardProps["researchSources"]}
      pipelineStatus={pipelineStatus as DashboardProps["pipelineStatus"]}
      eventGroups={eventGroups as DashboardProps["eventGroups"]}
    />
  );
}
