type ReviewedCsvRecord = {
  date: string;
  title: string;
  city: string;
  country: string;
  assetType: string;
  propertyType: string;
  status: string;
  pvRole: string;
  causeCategory: string;
  summary: string;
  sourceTitle: string;
  sourceUrl: string;
};

type IndexedCsvRecord = Omit<ReviewedCsvRecord, "city" | "status" | "causeCategory"> & {
  status: string;
};

export function escapeCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createIncidentCsv(reviewed: ReviewedCsvRecord[], indexed: IndexedCsvRecord[]) {
  const keys = [
    "recordType", "date", "title", "city", "country", "assetType", "propertyType",
    "evidence", "pvRole", "causeCategory", "summary", "sourceTitle", "sourceUrl",
  ] as const;
  const rows = [
    ...reviewed.map((item) => ({
      recordType: "reviewed", date: item.date, title: item.title, city: item.city, country: item.country,
      assetType: item.assetType, propertyType: item.propertyType, evidence: item.status, pvRole: item.pvRole,
      causeCategory: item.causeCategory, summary: item.summary, sourceTitle: item.sourceTitle, sourceUrl: item.sourceUrl,
    })),
    ...indexed.map((item) => ({
      recordType: "source-indexed", date: item.date, title: item.title, city: "", country: item.country,
      assetType: item.assetType, propertyType: item.propertyType, evidence: item.status, pvRole: item.pvRole,
      causeCategory: "", summary: item.summary, sourceTitle: item.sourceTitle, sourceUrl: item.sourceUrl,
    })),
  ];
  return [keys.join(","), ...rows.map((item) => keys.map((key) => escapeCsvCell(item[key])).join(","))].join("\n");
}
